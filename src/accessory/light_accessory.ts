import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service, LogLevel } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';
import _ from 'lodash';

export class light_accessory extends base_accessory {
  service?: Service;
  services?: Service[];
  state = { h: 0, s: 0, receiveSse: true };
  timeout: NodeJS.Timeout | null = null;
  receiveTimeout: NodeJS.Timeout | null = null;

  constructor(
	platform: HomebridgePlatform,
	accessory: PlatformAccessory | undefined,
	device: IDevice
  ) {
	super(platform, accessory, Categories.LIGHTBULB, device);
  }

  mountService(): void {
	if (!this.accessory) return;
	const accessory = this.accessory; // non-null assertion for TS

	// 1. Multi-gang light support
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.TOGGLE)) {
	  const channelInfo = deviceUtils.getMultiDeviceChannel(this.device);
	  this.services = [];

	  channelInfo.forEach(({ name: chanName, value: chanKey }, idx) => {
		const subtype = chanKey;
		const displayName = `${this.device.name} (${chanName.toUpperCase()})`;

		// Get or add per-channel Lightbulb service
		let svc = accessory.getService(displayName);
		if (!svc) {
		  svc = accessory.addService(
			this.platform.Service.Lightbulb,
			displayName,
			subtype
		  );
		}

		svc.setCharacteristic(
		  this.platform.Characteristic.Name,
		  displayName
		);

		// On/Off handler
		svc.getCharacteristic(this.platform.Characteristic.On)
		  .onGet(() => this.getDeviceStateByCap(ECapability.TOGGLE, this.device, idx))
		  .onSet(async (value: CharacteristicValue) => {
			const params = deviceUtils.getDeviceSendState(
			  ECapability.TOGGLE,
			  { value: value as boolean, index: idx }
			);
			await this.sendToDevice(params);
		  });

		// Brightness handler if supported
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
		  svc.getCharacteristic(this.platform.Characteristic.Brightness)
			.onGet(() => this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device, idx))
			.onSet(async (value: CharacteristicValue) => {
			  const params = deviceUtils.getDeviceSendState(
				ECapability.BRIGHTNESS,
				{ value: value as number, index: idx }
			  );
			  await this.debounceControlLight(params);
			});
		}

		this.services!.push(svc);
	  });
	  return;
	}

	// 2. Single-gang fallback: POWER
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.POWER)) {
	  let svc = accessory.getService(this.device.name);
	  if (!svc) {
		svc = accessory.addService(
		  this.platform.Service.Lightbulb,
		  this.device.name
		);
	  }
	  this.service = svc;

	  svc.getCharacteristic(this.platform.Characteristic.On)
		.onGet(() => this.getDeviceStateByCap(ECapability.POWER, this.device))
		.onSet(async (value: CharacteristicValue) => {
		  const params = deviceUtils.getDeviceSendState(
			ECapability.POWER,
			{ value: value as boolean }
		  );
		  await this.sendToDevice(params);
		});
	}

	// 3. Single-gang fallback: BRIGHTNESS
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.Brightness)
		.onGet(() => this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device))
		.onSet(async (value: CharacteristicValue) => {
		  const params = deviceUtils.getDeviceSendState(
			ECapability.BRIGHTNESS,
			{ value: value as number }
		  );
		  await this.debounceControlLight(params);
		});
	}

	// 4. Single-gang fallback: COLOR_TEMPERATURE
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_TEMPERATURE)) {
	  this.service?.getCharacteristic(
		this.platform.Characteristic.ColorTemperature
	  )
		.onGet(() => this.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device))
		.onSet(async (value: CharacteristicValue) => {
		  const params = deviceUtils.getDeviceSendState(
			ECapability.COLOR_TEMPERATURE,
			{ value: value as number }
		  );
		  await this.debounceControlLight(params);
		});
	}

	// 5. Single-gang fallback: COLOR_RGB (Hue/Saturation)
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_RGB)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.Hue)
		.onGet(() => {
		  const [h] =
			(this.getDeviceStateByCap(
			  ECapability.COLOR_RGB,
			  this.device
			) as unknown as [number, number, number]);
		  return h;
		})
		.onSet((value: CharacteristicValue) => {
		  this.state.h = value as number;
		  this.controlDeviceHSV();
		});

	  this.service?.getCharacteristic(
		this.platform.Characteristic.Saturation
	  )
		.onGet(() => {
		  const [, s] =
			(this.getDeviceStateByCap(
			  ECapability.COLOR_RGB,
			  this.device
			) as unknown as [number, number, number]);
		  return s;
		})
		.onSet((value: CharacteristicValue) => {
		  this.state.s = value as number;
		  this.controlDeviceHSV();
		});
	}
  }

  controlDeviceHSV() {
	if (!this.timeout) {
	  this.timeout = setTimeout(async () => {
		this.timeout = null;
		const { h, s } = this.state;
		const params = deviceUtils.getDeviceSendState(ECapability.COLOR_RGB, {
		  h,
		  s,
		  v: 100,
		});
		await this.sendToDevice(params);
	  }, 200);
	}
  }

  debounceControlLight = _.debounce(async (params: any) => {
	this.state.receiveSse = false;
	if (this.receiveTimeout) clearTimeout(this.receiveTimeout);
	this.receiveTimeout = setTimeout(() => {
	  this.state.receiveSse = true;
	}, 3000);
	await this.sendToDevice(params);
  }, 100);

  updateValue(): void {
	if (!this.state.receiveSse) return;

	// Multi-gang update
	if (this.device.state.toggle) {
	  const accessory = this.accessory!;
	  const channelInfo = deviceUtils.getMultiDeviceChannel(this.device);
	  channelInfo.forEach(({ name: chanName }, idx) => {
		const displayName = `${this.device.name} (${chanName.toUpperCase()})`;
		const svc = accessory.getService(displayName);
		const info = (this.device.state.toggle as any)[chanName];
		if (svc && info) {
		  svc.updateCharacteristic(
			this.platform.Characteristic.On,
			info.toggleState === 'on'
		  );
		}
	  });
	  return;
	}

	// Single-gang fallback update
	super.updateValue();
  }
}

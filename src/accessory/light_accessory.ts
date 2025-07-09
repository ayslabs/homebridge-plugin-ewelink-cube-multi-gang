import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';
import _ from 'lodash';

export class light_accessory extends base_accessory {
  private service?: Service;
  private services: Service[] = [];
  private state = { h: 0, s: 0, receiveSse: true };
  private timeout: NodeJS.Timeout | null = null;
  private receiveTimeout: NodeJS.Timeout | null = null;

  constructor(
	platform: HomebridgePlatform,
	accessory: PlatformAccessory | undefined,
	device: IDevice
  ) {
	super(platform, accessory, Categories.LIGHTBULB, device);
  }

  mountService(): void {
	if (!this.accessory) return;
	const accessory = this.accessory;

	// Multi-gang support
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.TOGGLE)) {
	  this.services = [];
	  const channels = deviceUtils.getMultiDeviceChannel(this.device);

	  channels.forEach(({ name: chanName, value: chanKey }, idx) => {
		const displayName = `${this.device.name} (${chanName.toUpperCase()})`;
		let svc = accessory.getService(displayName);
		if (!svc) {
		  svc = accessory.addService(
			this.platform.Service.Lightbulb,
			displayName,
			chanKey
		  );
		}
		svc.setCharacteristic(
		  this.platform.Characteristic.Name,
		  displayName
		);

		// On/Off characteristic
		svc.getCharacteristic(this.platform.Characteristic.On)
		  .onGet(() => {
			const info = (this.device.state.toggle as any)[chanKey];
			return info?.toggleState === 'on';
		  })
		  .onSet(async (value: CharacteristicValue) => {
			const params = deviceUtils.getDeviceSendState(
			  ECapability.TOGGLE,
			  { value: value as boolean, index: idx }
			);
			this.platform.log.debug('Multi-gang toggle params', params);
			await this.sendToDevice(params);
		  });

		// Brightness characteristic (if supported)
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
		  svc.getCharacteristic(this.platform.Characteristic.Brightness)
			.onGet(() => {
			  const brightInfo = (this.device.state.brightness as any)[chanKey];
			  return brightInfo?.brightness ?? 100;
			})
			.onSet(async (value: CharacteristicValue) => {
			  const params = deviceUtils.getDeviceSendState(
				ECapability.BRIGHTNESS,
				{ value: value as number, index: idx }
			  );
			  this.platform.log.debug('Multi-gang brightness params', params);
			  await this.sendToDevice(params);
			});
		}

		this.services.push(svc);
	  });
	  return;
	}

	// Single-gang: POWER
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
		  this.platform.log.debug('Single-gang power params', params);
		  await this.sendToDevice(params);
		});
	}

	// Single-gang: BRIGHTNESS
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.Brightness)
		.onGet(() => this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device))
		.onSet(async (value: CharacteristicValue) => {
		  const params = deviceUtils.getDeviceSendState(
			ECapability.BRIGHTNESS,
			{ value: value as number }
		  );
		  this.platform.log.debug('Single-gang brightness params', params);
		  await this.sendToDevice(params);
		});
	}

	// Single-gang: COLOR_TEMPERATURE
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
		  this.platform.log.debug('Single-gang CT params', params);
		  await this.sendToDevice(params);
		});
	}

	// Single-gang: COLOR_RGB
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_RGB)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.Hue)
		.onGet(() =>
		  (this.getDeviceStateByCap(
			ECapability.COLOR_RGB,
			this.device
		  ) as [number, number, number])[0]
		)
		.onSet((value: CharacteristicValue) => {
		  this.state.h = value as number;
		  this.controlDeviceHSV();
		});

	  this.service?.getCharacteristic(
		this.platform.Characteristic.Saturation
	  )
		.onGet(() =>
		  (this.getDeviceStateByCap(
			ECapability.COLOR_RGB,
			this.device
		  ) as [number, number, number])[1]
		)
		.onSet((value: CharacteristicValue) => {
		  this.state.s = value as number;
		  this.controlDeviceHSV();
		});
	}
  }

  private controlDeviceHSV(): void {
	if (this.timeout) return;
	this.timeout = setTimeout(async () => {
	  this.timeout = null;
	  const { h, s } = this.state;
	  const params = deviceUtils.getDeviceSendState(
		ECapability.COLOR_RGB,
		{ h, s, v: 100 }
	  );
	  this.platform.log.debug('HSV params', params);
	  await this.sendToDevice(params);
	}, 200);
  }

  private debounceControlLight = _.debounce(async (params: any) => {
	this.state.receiveSse = false;
	if (this.receiveTimeout) clearTimeout(this.receiveTimeout);
	this.receiveTimeout = setTimeout(() => {
	  this.state.receiveSse = true;
	}, 3000);
	this.platform.log.debug('Debounced params', params);
	await this.sendToDevice(params);
  }, 100);

  updateValue(): void {
	if (!this.state.receiveSse) return;

	// Multi-gang update
	if (this.device.state.toggle) {
	  const accessory = this.accessory!;
	  const channels = deviceUtils.getMultiDeviceChannel(this.device);
	  channels.forEach(({ name: chanName }) => {
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

	// Fallback to base class handling
	super.updateValue();
  }
}

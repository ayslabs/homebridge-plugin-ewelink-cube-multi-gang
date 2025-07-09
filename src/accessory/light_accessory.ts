import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';
import _ from 'lodash';

export class light_accessory extends base_accessory {
  private service?: Service;
  private services?: Service[];
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

	// Multi-gang light support (toggle channels)
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.TOGGLE)) {
	  const channels = deviceUtils.getMultiDeviceChannel(this.device);
	  this.services = [];

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
		svc.setCharacteristic(this.platform.Characteristic.Name, displayName);

		// On/Off handler (toggle)
		svc.getCharacteristic(this.platform.Characteristic.On)
		  .onGet(() => this.getDeviceStateByCap(ECapability.TOGGLE, this.device, idx))
		  .onSet(async (value: CharacteristicValue) => {
			const params = deviceUtils.getDeviceSendState(
			  ECapability.TOGGLE,
			  { value: value as boolean, index: idx }
			);
			this.platform.log.debug('Sending toggle command', params);
			await this.platform.sendCommand(this.device, params);
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
			  this.platform.log.debug('Sending brightness command', params);
			  await this.platform.sendCommand(this.device, params);
			});
		}

		this.services!.push(svc);
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
		  this.platform.log.debug('Sending power command', params);
		  await this.platform.sendCommand(this.device, params);
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
		  this.platform.log.debug('Sending brightness command', params);
		  await this.platform.sendCommand(this.device, params);
		});
	}

	// Single-gang: COLOR_TEMPERATURE
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_TEMPERATURE)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.ColorTemperature)
		.onGet(() => this.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device))
		.onSet(async (value: CharacteristicValue) => {
		  const params = deviceUtils.getDeviceSendState(
			ECapability.COLOR_TEMPERATURE,
			{ value: value as number }
		  );
		  this.platform.log.debug('Sending color-temp command', params);
		  await this.platform.sendCommand(this.device, params);
		});
	}

	// Single-gang: COLOR_RGB (Hue/Saturation)
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_RGB)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.Hue)
		.onGet(() => {
		  const [h] = this.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as [number, number, number];
		  return h;
		})
		.onSet((value: CharacteristicValue) => {
		  this.state.h = value as number;
		  this.controlDeviceHSV();
		});
	  this.service?.getCharacteristic(this.platform.Characteristic.Saturation)
		.onGet(() => {
		  const [, s] = this.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as [number, number, number];
		  return s;
		})
		.onSet((value: CharacteristicValue) => {
		  this.state.s = value as number;
		  this.controlDeviceHSV();
		});
	}
  }

  private controlDeviceHSV() {
	if (!this.timeout) {
	  this.timeout = setTimeout(async () => {
		this.timeout = null;
		const { h, s } = this.state;
		const params = deviceUtils.getDeviceSendState(ECapability.COLOR_RGB, { h, s, v: 100 });
		this.platform.log.debug('Sending HSV command', params);
		await this.platform.sendCommand(this.device, params);
	  }, 200);
	}
  }

  private debounceControlLight = _.debounce(async (params: any) => {
	this.state.receiveSse = false;
	if (this.receiveTimeout) clearTimeout(this.receiveTimeout);
	this.receiveTimeout = setTimeout(() => {
	  this.state.receiveSse = true;
	}, 3000);
	this.platform.log.debug('Sending debounced command', params);
	await this.platform.sendCommand(this.device, params);
  }, 100);

  updateValue(): void {
	if (!this.state.receiveSse) return;

	// Multi-gang updates
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

	// Single-gang fallback update
	super.updateValue();
  }
}

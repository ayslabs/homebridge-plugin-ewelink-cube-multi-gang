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

	// Multi-gang support
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.TOGGLE)) {
	  this.services = [];
	  const channels = deviceUtils.getMultiDeviceChannel(this.device);

	  for (const { name: chanName, value: chanKey } of channels) {
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

		// On/Off characteristic
		svc.getCharacteristic(this.platform.Characteristic.On)
		  .onGet(() => {
			const info = (this.device.state.toggle as any)[chanKey];
			return info?.toggleState === 'on';
		  })
		  .onSet(async (value: CharacteristicValue) => {
			const payload = { toggle: { [chanKey]: (value as boolean) ? 'on' : 'off' } };
			this.platform.log.debug('Multi-gang toggle', payload);
			await this.sendToDevice({ state: payload });
		  });

		// Brightness characteristic (if supported)
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
		  svc.getCharacteristic(this.platform.Characteristic.Brightness)
			.onGet(() => {
			  const bright = (this.device.state.brightness as any)?.[chanKey]?.brightness;
			  return bright ?? 100;
			})
			.onSet(async (value: CharacteristicValue) => {
			  const payload = { brightness: { [chanKey]: value as number } };
			  this.platform.log.debug('Multi-gang brightness', payload);
			  await this.sendToDevice({ state: payload });
			});
		}

		this.services.push(svc);
	  }
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
		  const payload = { power: { value: value as boolean } };
		  this.platform.log.debug('Single-gang power', payload);
		  await this.sendToDevice({ state: payload });
		});
	}

	// Single-gang: BRIGHTNESS
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.Brightness)
		.onGet(() => this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device))
		.onSet(async (value: CharacteristicValue) => {
		  const payload = { brightness: value as number };
		  this.platform.log.debug('Single-gang brightness', payload);
		  await this.sendToDevice({ state: payload });
		});
	}

	// ColorTemperature
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_TEMPERATURE)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.ColorTemperature)
		.onGet(() => this.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device))
		.onSet(async (value: CharacteristicValue) => {
		  const payload = { colorTemperature: value as number };
		  this.platform.log.debug('Color temperature', payload);
		  await this.sendToDevice({ state: payload });
		});
	}

	// RGB
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_RGB)) {
	  this.service?.getCharacteristic(this.platform.Characteristic.Hue)
		.onGet(() => (this.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as [number, number, number])[0])
		.onSet((value: CharacteristicValue) => {
		  this.state.h = value as number;
		  this.controlDeviceHSV();
		});

	  this.service?.getCharacteristic(this.platform.Characteristic.Saturation)
		.onGet(() => (this.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as [number, number, number])[1])
		.onSet((value: CharacteristicValue) => {
		  this.state.s = value as number;
		  this.controlDeviceHSV();
		});
	}
  }

  private controlDeviceHSV() {
	if (this.timeout) return;
	this.timeout = setTimeout(async () => {
	  this.timeout = null;
	  const { h, s } = this.state;
	  const payload = { color: { h, s, v: 100 } };
	  this.platform.log.debug('HSV payload', payload);
	  await this.sendToDevice({ state: payload });
	}, 200);
  }

  private debounceControlLight = _.debounce(async (params: any) => {
	this.state.receiveSse = false;
	if (this.receiveTimeout) clearTimeout(this.receiveTimeout);
	this.receiveTimeout = setTimeout(() => {
	  this.state.receiveSse = true;
	}, 3000);
	this.platform.log.debug('Debounced payload', params);
	await this.sendToDevice({ state: params });
  }, 100);

  updateValue(): void {
	if (!this.state.receiveSse) return;

	if (this.device.state.toggle) {
	  const accessory = this.accessory!;
	  const channels = deviceUtils.getMultiDeviceChannel(this.device);
	  for (const { name: chanName } of channels) {
		const displayName = `${this.device.name} (${chanName.toUpperCase()})`;
		const svc = accessory.getService(displayName);
		const info = (this.device.state.toggle as any)[chanName];
		if (svc && info) {
		  svc.updateCharacteristic(
			this.platform.Characteristic.On,
			info.toggleState === 'on'
		  );
		}
	  }
	  return;
	}

	super.updateValue();
  }
}

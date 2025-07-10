import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class light_accessory extends base_accessory {
  private services: Service[] = [];
  private state = { receiveSse: true };

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

	// Multi-gang support: split into separate Lightbulb services
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
		// On/Off
		svc.getCharacteristic(this.platform.Characteristic.On)
		  .onGet(() => {
			const info = (this.device.state.toggle as any)[chanKey];
			return info?.toggleState === 'on';
		  })
		  .onSet(async (v: CharacteristicValue) => {
			const params = deviceUtils.getDeviceSendState(
			  ECapability.TOGGLE,
			  { value: v as boolean, index: idx }
			);
			await this.sendToDevice(params);
		  });

		// Brightness fallback (if dimmer capability present)
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
		  svc.getCharacteristic(this.platform.Characteristic.Brightness)
			.onGet(() => {
			  const brightInfo = (this.device.state.brightness as any)?.[chanKey];
			  if (brightInfo && brightInfo.brightness != null) {
				return brightInfo.brightness;
			  }
			  const info = (this.device.state.toggle as any)[chanKey];
			  return info?.toggleState === 'on' ? 100 : 0;
			})
			.onSet(async (v: CharacteristicValue) => {
			  const on = (v as number) > 50;
			  const params = deviceUtils.getDeviceSendState(
				ECapability.TOGGLE,
				{ value: on, index: idx }
			  );
			  await this.sendToDevice(params);
			});
		}

		this.services.push(svc);
	  });
	  return;
	}

	// Single-gang fallback: one Lightbulb service
	let svc = accessory.getService(this.device.name);
	if (!svc) {
	  svc = accessory.addService(
		this.platform.Service.Lightbulb,
		this.device.name
	  );
	}
	this.services = [svc];

	// Power On/Off
	svc.getCharacteristic(this.platform.Characteristic.On)
	  .onGet(() => this.getDeviceStateByCap(ECapability.POWER, this.device))
	  .onSet(async (v: CharacteristicValue) => {
		const params = deviceUtils.getDeviceSendState(
		  ECapability.POWER,
		  { value: v as boolean }
		);
		await this.sendToDevice(params);
	  });

	// Brightness
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
	  svc.getCharacteristic(this.platform.Characteristic.Brightness)
		.onGet(() => this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device))
		.onSet(async (v: CharacteristicValue) => {
		  const params = deviceUtils.getDeviceSendState(
			ECapability.BRIGHTNESS,
			{ value: v as number }
		  );
		  await this.sendToDevice(params);
		});
	}
  }

  updateValue(): void {
	if (!this.state.receiveSse) return;
	if (this.device.state.toggle) {
	  const accessory = this.accessory!;
	  const channels = deviceUtils.getMultiDeviceChannel(this.device);
	  channels.forEach(({ name: chanName, value: chanKey }) => {
		const displayName = `${this.device.name} (${chanName.toUpperCase()})`;
		const svc = accessory.getService(displayName);
		const info = (this.device.state.toggle as any)[chanKey];
		svc?.updateCharacteristic(
		  this.platform.Characteristic.On,
		  info.toggleState === 'on'
		);
		svc?.updateCharacteristic(
		  this.platform.Characteristic.Brightness,
		  info.toggleState === 'on' ? 100 : 0
		);
	  });
	  return;
	}
	super.updateValue();
  }
}

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

	// Multi-gang support: separate services per channel
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

		// On/Off characteristic
		svc.getCharacteristic(this.platform.Characteristic.On)
		  .onGet(() => this.getDeviceStateByCap(ECapability.TOGGLE, this.device, idx))
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
			.onGet(() => this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device, idx))
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
	  .onSet(async (value: CharacteristicValue) => {
		const params = deviceUtils.getDeviceSendState(
		  ECapability.POWER,
		  { value: value as boolean }
		);
		this.platform.log.debug('Single-gang power params', params);
		await this.sendToDevice(params);
	  });

	// Brightness
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
	  svc.getCharacteristic(this.platform.Characteristic.Brightness)
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
  }

  updateValue(): void {
	if (!this.state.receiveSse) return;

	// Multi-gang update
	if (this.device.state.toggle) {
	  const accessory = this.accessory!;
	  const channels = deviceUtils.getMultiDeviceChannel(this.device);
	  channels.forEach(({ name: chanName }, idx) => {
		const displayName = `${this.device.name} (${chanName.toUpperCase()})`;
		const svc = accessory.getService(displayName);
		const stateObj = this.getDeviceStateByCap(ECapability.TOGGLE, this.device, idx) as boolean;
		svc?.updateCharacteristic(this.platform.Characteristic.On, stateObj);
	  });
	  return;
	}

	// Single-gang update
	super.updateValue();
  }
}

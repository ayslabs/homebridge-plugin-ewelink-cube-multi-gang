import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class light_accessory extends base_accessory {
  private services: Service[] = [];
  private sseEnabled = true;

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

	// Multi-gang toggle support
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
		  .onGet(() =>
			this.getDeviceStateByCap(ECapability.TOGGLE, this.device, idx) as boolean
		  )
		  .onSet(async (value: CharacteristicValue) => {
			const params = deviceUtils.getDeviceSendState(
			  ECapability.TOGGLE,
			  { value: value as boolean, index: idx }
			);
			await this.sendToDevice(params);
		  });

		// Brightness slider acts as on/off toggle
		svc.getCharacteristic(this.platform.Characteristic.Brightness)
		  .onGet(() => {
			const isOn = this.getDeviceStateByCap(
			  ECapability.TOGGLE,
			  this.device,
			  idx
			) as boolean;
			return isOn ? 100 : 0;
		  })
		  .onSet(async (value: CharacteristicValue) => {
			const on = (value as number) >= 50;
			const params = deviceUtils.getDeviceSendState(
			  ECapability.TOGGLE,
			  { value: on, index: idx }
			);
			await this.sendToDevice(params);
		  });

		this.services.push(svc);
	  });

	  return;
	}

	// Single-gang fallback
	let svc = accessory.getService(this.device.name);
	if (!svc) {
	  svc = accessory.addService(
		this.platform.Service.Lightbulb,
		this.device.name
	  );
	}
	this.services = [svc];

	// On/Off characteristic
	svc.getCharacteristic(this.platform.Characteristic.On)
	  .onGet(() =>
		this.getDeviceStateByCap(ECapability.POWER, this.device) as boolean
	  )
	  .onSet(async (value: CharacteristicValue) => {
		const params = deviceUtils.getDeviceSendState(
		  ECapability.POWER,
		  { value: value as boolean }
		);
		await this.sendToDevice(params);
	  });

	// Brightness if supported
	if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
	  svc.getCharacteristic(this.platform.Characteristic.Brightness)
		.onGet(() =>
		  this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device) as number
		)
		.onSet(async (value: CharacteristicValue) => {
		  const params = deviceUtils.getDeviceSendState(
			ECapability.BRIGHTNESS,
			{ value: value as number }
		  );
		  await this.sendToDevice(params);
		});
	}
  }

  updateValue(): void {
	if (!this.sseEnabled) return;

	// Multi-gang update
	if (this.device.state.toggle) {
	  const channels = deviceUtils.getMultiDeviceChannel(this.device);
	  channels.forEach(({ name: chanName }, idx) => {
		const displayName = `${this.device.name} (${chanName.toUpperCase()})`;
		const svc = this.accessory!.getService(displayName);
		const isOn = this.getDeviceStateByCap(
		  ECapability.TOGGLE,
		  this.device,
		  idx
		) as boolean;
		svc?.updateCharacteristic(this.platform.Characteristic.On, isOn);
		svc?.updateCharacteristic(
		  this.platform.Characteristic.Brightness,
		  isOn ? 100 : 0
		);
	  });

	  return;
	}

	// Single-gang update
	super.updateValue();
  }
}

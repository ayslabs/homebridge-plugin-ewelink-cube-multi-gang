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
			// Build full toggle map including this channel change
			const currentToggle = this.device.state.toggle as Record<string, {toggleState: string}>;
			const fullToggle: Record<string, {toggleState: string}> = {};
			Object.entries(currentToggle).forEach(([key, info]) => {
			  fullToggle[key] = { toggleState: info.toggleState };
			});
			fullToggle[chanKey] = { toggleState: (value as boolean) ? 'on' : 'off' };
			const payload = { state: { toggle: fullToggle } };
			this.platform.log.debug('Full multi-gang payload', payload);
			await this.sendToDevice(payload);
		  });

		// Brightness characteristic (full dim support)
		svc.getCharacteristic(this.platform.Characteristic.Brightness)
		  .onGet(() => {
			// Return actual brightness if available, else map toggle state
			const brightnessState = (this.device.state.brightness as any)?.[chanKey]?.brightness;
			if (brightnessState != null) {
			  return brightnessState;
			}
			const isOn = this.getDeviceStateByCap(
			  ECapability.TOGGLE,
			  this.device,
			  idx
			) as boolean;
			return isOn ? 100 : 0;
		  })
		  .onSet(async (value: CharacteristicValue) => {
			// Build full brightness map
			const currentToggle = this.device.state.toggle as Record<string,{toggleState:string}>;
			const currentBrightness = this.device.state.brightness as Record<string,{brightness:number}>;
			const fullBrightness: Record<string,{brightness:number}> = {};
			channels.forEach(({ value: key }) => {
			  const b = currentBrightness?.[key]?.brightness;
			  if (b != null) fullBrightness[key] = { brightness: b };
			  else {
				// default from toggle
				const t = currentToggle[key].toggleState === 'on' ? 100 : 0;
				fullBrightness[key] = { brightness: t };
			  }
			});
			// override this channel
			fullBrightness[chanKey] = { brightness: value as number };
			const payload = { state: { brightness: fullBrightness } };
			this.platform.log.debug('Full multi-gang brightness payload', payload);
			await this.sendToDevice(payload);
		  });

		this.services.push(svc);(svc);
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

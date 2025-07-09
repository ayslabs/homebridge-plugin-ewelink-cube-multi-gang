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
	state = {
		h: 0,
		s: 0,
		receiveSse: true
	};

	mountService(): void {
		if (!this.accessory) return;

		// 1. Multi-gang light support: check for toggle capability
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.TOGGLE)) {
			// Get channel definitions (e.g., l1, l2)
			const channelInfo = deviceUtils.getMultiDeviceChannel(this.device);
			this.services = [];

			channelInfo.forEach(({ name: chanName, value: chanKey }, idx) => {
				// Use channel key as the subtype to differentiate services
				const svc = this.accessory!.getService(this.platform.Service.Lightbulb, chanKey)
					|| this.accessory?.addService(
						this.platform.Service.Lightbulb,
						`${this.device.name} ${chanName}`,
						chanKey
					);

				// Set a clear name
				svc.setCharacteristic(
					this.platform.Characteristic.Name,
					`${this.device.name} ${chanName}`
				);

				// On/Off handler for this channel
				svc.getCharacteristic(this.platform.Characteristic.On)
					.onGet(() => this.getDeviceStateByCap(ECapability.TOGGLE, this.device, idx))
					.onSet(async (value: CharacteristicValue) => {
						const params = deviceUtils.getDeviceSendState(ECapability.TOGGLE, { value: value as boolean, index: idx });
						await this.sendToDevice(params);
					});

				// Brightness handler if supported
				if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
					svc.getCharacteristic(this.platform.Characteristic.Brightness)
						.onGet(() => this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device, idx))
						.onSet(async (value: CharacteristicValue) => {
							const params = deviceUtils.getDeviceSendState(ECapability.BRIGHTNESS, { value: value as number, index: idx });
							await this.sendToDevice(params);
						});
				}

				this.services!.push(svc);
			});
			return;
		}

		// 2. Fallback to single-service logic (power, brightness, color, etc.)
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.POWER)) {
			this.service = this.accessory!.getService(this.platform.Service.Lightbulb)
				|| this.accessory?.addService(this.platform.Service.Lightbulb);

			this.service.getCharacteristic(this.platform.Characteristic.On)
				.onGet(() => this.getDeviceStateByCap(ECapability.POWER, this.device))
				.onSet(async (value: CharacteristicValue) => {
					const params = deviceUtils.getDeviceSendState(ECapability.POWER, { value });
					await this.sendToDevice(params);
				});
		}

		// ... existing brightness, hue, saturation, color-temperature handlers ...
	}

	updateValue(): void {
		const stateKeys = Object.keys(this.device.state);
		if (!stateKeys.length) return;

		// 1. Multi-gang toggle updates
		if (this.device.state.toggle) {
			Object.entries(this.device.state.toggle).forEach(([chanKey, info]: any) => {
				const svc = this.accessory?.getService(this.platform.Service.Lightbulb, chanKey);
				svc?.updateCharacteristic(
					this.platform.Characteristic.On,
					info.toggleState === 'on'
				);
			});
			return;
		}

		// 2. Fallback to single-service updates
		stateKeys.forEach(stateKey => {
			if (stateKey === 'power') {
				this.service?.updateCharacteristic(
					this.platform.Characteristic.On,
					this.getDeviceStateByCap(ECapability.POWER, this.device)
				);
			} else if (stateKey === 'brightness') {
				this.service?.updateCharacteristic(
					this.platform.Characteristic.Brightness,
					this.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device)
				);
			} else if (stateKey === 'color-temperature') {
				this.service?.updateCharacteristic(
					this.platform.Characteristic.ColorTemperature,
					this.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device)
				);
			} else if (stateKey === 'color-rgb') {
				const [h, s, v] = (this.getDeviceStateByCap(
					ECapability.COLOR_RGB,
					this.device
				) as unknown as [number, number, number]);
				this.service?.updateCharacteristic(this.platform.Characteristic.Hue, h);
				this.service?.updateCharacteristic(this.platform.Characteristic.Saturation, s);
			}
		});
	}
}

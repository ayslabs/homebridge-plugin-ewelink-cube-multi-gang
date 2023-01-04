import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class light_accessory extends base_accessory {

	service: Service | undefined;
	state = {
		h: 0,
		s: 0
	}
	timeout: NodeJS.Timeout | null = null

	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.LIGHTBULB, device);
	}
	mountService(): void {
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.POWER)) {
			this.service = this.accessory!.getService(this.platform.Service.Lightbulb) || this.accessory?.addService(this.platform.Service.Lightbulb);
			this.service?.getCharacteristic(this.platform.Characteristic.On)
				.onGet(() => {
					return deviceUtils.getDeviceStateByCap(ECapability.POWER, this.device)
				})
				.onSet((value: CharacteristicValue) => {
					const params = deviceUtils.getDeviceSendState(ECapability.POWER, { value })
					this.sendToDevice(params)
				});
		}

		if (deviceUtils.renderServiceByCapability(this.device, ECapability.BRIGHTNESS)) {
			this.service?.getCharacteristic(this.platform.Characteristic.Brightness)
				.onGet(() => {
					return deviceUtils.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device)
				})
				.onSet((value: CharacteristicValue) => {
					const params = deviceUtils.getDeviceSendState(ECapability.BRIGHTNESS, { value })
					this.sendToDevice(params)
				});
		}
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_TEMPERATURE)) {
			this.service?.getCharacteristic(this.platform.Characteristic.ColorTemperature)
				// .setProps({
				// 	minValue: 0,
				// 	maxValue: 100
				// })
				.onGet(() => {
					this.platform.log.info('color-temperature', deviceUtils.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device))
					return deviceUtils.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device)
				})
				.onSet((value: CharacteristicValue) => {
					const params = deviceUtils.getDeviceSendState(ECapability.COLOR_TEMPERATURE, { value })
					this.sendToDevice(params)
				});
		}

		if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_RGB)) {
			this.service?.getCharacteristic(this.platform.Characteristic.Hue)
				.onGet(() => {
					const [h, s, v] = (deviceUtils.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as unknown as [h: number, s: number, v: number])
					return h
				})
				.onSet((value: CharacteristicValue) => {
					this.platform.log.info('hue---->', value)
					this.state.h = value as number
					this.controlDeviceHSV()
				})

			this.service?.getCharacteristic(this.platform.Characteristic.Saturation)
				.onGet(() => {
					const [h, s, v] = (deviceUtils.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as unknown as [h: number, s: number, v: number])
					return s
				})
				.onSet((value: CharacteristicValue) => {
					this.platform.log.info('saturation---->', value)
					this.state.s = value as number
					this.controlDeviceHSV()
				})

		}
	}
	controlDeviceHSV() {
		if (!this.timeout) {
			this.timeout = setTimeout(() => {
				this.timeout = null;
				const { h, s } = this.state
				const params = deviceUtils.getDeviceSendState(ECapability.COLOR_RGB, { h, s, v: 100 })
				this.sendToDevice(params)
			}, 200)
		}
	}
	updateValue(deviceState: any): void {
		this.platform.log.info('light_accessory updateValue', JSON.stringify(this.device.state, null, 2));
		// let state: any = {}
		// if (!deviceState) {
		// 	state = this.device.state
		// } else {
		// 	state = deviceState
		// }
		const stateArr = Object.keys(this.device.state);
		if (!stateArr.length) return;
		stateArr.forEach(stateKey => {
			if (stateKey === 'power') {
				this.service?.updateCharacteristic(this.platform.Characteristic.On, deviceUtils.getDeviceStateByCap(ECapability.POWER, this.device))
			} else if (stateKey === 'brightness') {
				this.service?.updateCharacteristic(this.platform.Characteristic.Brightness, deviceUtils.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device))
			} else if (stateKey === 'color-temperature') {
				this.platform.log.info('updateValue color-temperature', deviceUtils.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device))
				this.service?.updateCharacteristic(this.platform.Characteristic.ColorTemperature, deviceUtils.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device))
			} else if (stateKey === 'color-rgb') {
				const [h, s, v] = (deviceUtils.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as unknown as [h: number, s: number, v: number])
				this.service?.updateCharacteristic(this.platform.Characteristic.Hue, h)
				this.service?.updateCharacteristic(this.platform.Characteristic.Saturation, s)
			}
		})
	}
}

import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';
import _ from 'lodash';

export class light_accessory extends base_accessory {

	service: Service | undefined;
	state = {
		h: 0,
		s: 0,
		receiveSse: true
	}
	timeout: NodeJS.Timeout | null = null
	receiveTimeout: NodeJS.Timeout | null = null

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
				.setProps({
					minValue: 1
				})
				.onGet(() => {
					return deviceUtils.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device)
				})
				.onSet((value: CharacteristicValue) => {
					const params = deviceUtils.getDeviceSendState(ECapability.BRIGHTNESS, { value })
					this.state.receiveSse = false
					if (this.receiveTimeout) {
						clearTimeout(this.receiveTimeout)
					}
					this.receiveTimeout = setTimeout(() => {
						this.state.receiveSse = true
					}, 3000)
					this.debounceControBrightness(params)
				});
		}
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.COLOR_TEMPERATURE)) {
			this.service?.getCharacteristic(this.platform.Characteristic.ColorTemperature)
				.setProps({
					minValue: 0,
					maxValue: 100
				})
				.onGet(() => {
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
					this.state.h = value as number
					this.controlDeviceHSV()
				})

			this.service?.getCharacteristic(this.platform.Characteristic.Saturation)
				.onGet(() => {
					const [h, s, v] = (deviceUtils.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as unknown as [h: number, s: number, v: number])
					return s
				})
				.onSet((value: CharacteristicValue) => {
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
	debounceControBrightness = _.debounce(params => this.sendToDevice(params), 100)
	updateValue(sse: boolean): void {
		const stateArr = Object.keys(this.device.state);
		if (!stateArr.length) return;
		stateArr.forEach(stateKey => {
			if (stateKey === 'power') {
				this.service?.updateCharacteristic(this.platform.Characteristic.On, deviceUtils.getDeviceStateByCap(ECapability.POWER, this.device))
			} else if (stateKey === 'brightness') {
				if (!this.state.receiveSse) return;
				this.service?.updateCharacteristic(this.platform.Characteristic.Brightness, deviceUtils.getDeviceStateByCap(ECapability.BRIGHTNESS, this.device))
			} else if (stateKey === 'color-temperature') {
				this.service?.updateCharacteristic(this.platform.Characteristic.ColorTemperature, deviceUtils.getDeviceStateByCap(ECapability.COLOR_TEMPERATURE, this.device))
			} else if (stateKey === 'color-rgb') {
				const [h, s, v] = (deviceUtils.getDeviceStateByCap(ECapability.COLOR_RGB, this.device) as unknown as [h: number, s: number, v: number])
				this.service?.updateCharacteristic(this.platform.Characteristic.Hue, h)
				this.service?.updateCharacteristic(this.platform.Characteristic.Saturation, s)
			}
		})
	}
}

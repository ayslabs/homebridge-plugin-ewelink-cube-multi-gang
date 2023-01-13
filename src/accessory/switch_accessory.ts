import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';

export class switch_accessory extends base_accessory {

	switchService: Service | undefined;
	switchService_0: Service | undefined;
	switchService_1: Service | undefined;
	switchService_2: Service | undefined;
	switchService_3: Service | undefined;

	constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
		super(platform, accessory, Categories.SWITCH, device);
	}
	mountService(): void {
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.TOGGLE)) {
			const channelInfo = deviceUtils.getMultiDeviceChannel(this.device);
			for (let i = 0; i < channelInfo.length; i++) {
				let service = `switchService_${i}` as 'switchService_0' | 'switchService_1' | 'switchService_2' | 'switchService_3';
				let switchState = `switch_${i}` as 'switch_0' | 'switch_1' | 'switch_2' | 'switch_3';
				let subService: string = `switch_${i}`;
				let channelName = channelInfo[i].name;
				if (i === 0) {
					this[service] = this.accessory?.getService(this.platform.Service.Switch) || this.accessory?.addService(this.platform.Service.Switch, channelName);
				} else {
					this[service] = this.accessory?.getService(subService) || this.accessory?.addService(this.platform.Service.Switch, channelName, subService);
				}
				this[service]?.getCharacteristic(this.platform.Characteristic.On)
					.onGet(() => {
						const index = switchState.split('_')[1]
						return this.getDeviceStateByCap(ECapability.TOGGLE, this.device, +index)
					})
					.onSet(async (value: CharacteristicValue) => {
						const index = switchState.split('_')[1]
						const params = deviceUtils.getDeviceSendState(ECapability.TOGGLE, { value, index: +index })
						await this.sendToDevice(params)
					});
			}
		}
		if (deviceUtils.renderServiceByCapability(this.device, ECapability.POWER) && !deviceUtils.renderServiceByCapability(this.device, ECapability.TOGGLE)) {
			this.switchService = this.accessory?.getService(this.platform.Service.Switch) || this.accessory?.addService(this.platform.Service.Switch);
			this.switchService?.getCharacteristic(this.platform.Characteristic.On)
				.onGet(() => {
					return this.getDeviceStateByCap(ECapability.POWER, this.device)
				})
				.onSet(async (value: CharacteristicValue) => {
					const params = deviceUtils.getDeviceSendState(ECapability.POWER, { value })
					await this.sendToDevice(params)
				})
		}
	}
	updateValue(): void {
		const stateArr = Object.keys(this.device.state);
		if (!stateArr.length) return;
		stateArr.forEach(stateKey => {
			if (stateKey === 'power') {
				this.switchService?.updateCharacteristic(this.platform.Characteristic.On, this.getDeviceStateByCap(ECapability.POWER, this.device))
			} else if (stateKey === 'toggle') {
				const toggleItem = this.device.state['toggle'];
				Object.keys(toggleItem).forEach(channel => {
					const serviceName = `switchService_${+channel - 1}` as 'switchService_0' | 'switchService_1' | 'switchService_2' | 'switchService_3'
					this[serviceName]?.updateCharacteristic(this.platform.Characteristic.On, this.getDeviceStateByCap(ECapability.TOGGLE, this.device, +channel - 1))
				})
			}
		})
	}
}

import { API, APIEvent, DynamicPlatformPlugin, Logger, LogLevel, PlatformAccessory, PlatformConfig, Service, Characteristic, Categories } from "homebridge";
import DeviceType from './accessory/index';
import { PLATFORM_NAME, PLUGIN_NAME } from "./config/platformConfig";
import Devices from './simulationDevice/index'
import { ECategory } from "./ts/enum/ECategory";
import { IBaseAccessory } from "./ts/interface/IBaseAccessory";
import { IDevice } from "./ts/interface/IDevice";
import { IPlatFormConfig, IDeviceConfig } from "./ts/interface/IPlatFormConfig";

import WebSocket from 'isomorphic-ws';
import { IHttpConfig } from "./ts/interface/IHttpConfig";
import { EHttpPath } from "./ts/enum/EHttpPath";
import { EMethod } from "./ts/enum/EMethod";
import httpRequest from "./service/httpRequest";
import ihostConfig from "./config/IhostConfig";
export class HomebridgePlatform implements DynamicPlatformPlugin {
	public readonly Service: typeof Service = this.api.hap.Service;
	public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

	//	cache accessory info
	public accessories = new Map<string, PlatformAccessory>()
	public formatAccessory = new Map<string, IBaseAccessory>()
	public httpErrorMap = new Map<number, string>([
		[401, 'invalid access_token'],
		[500, 'server error']
	])

	constructor(public readonly log: Logger, public readonly config: IPlatFormConfig, public readonly api: API) {
		this.log.info('----Finished initializing platform config-----', this.config)
		this.api.on(APIEvent.DID_FINISH_LAUNCHING, async () => {
			this.log.info('----Executed didFinishLaunching callback----');
			//  TODO
			const { ip, at, devices = [] } = this.config

			//	1. 确认是否有可用 ihost 设备,ip at 有效
			if (!ip || !at) {
				this.log.warn('***** No avaliable ihost! Please check the config.json *****');
				return;
			}

			try {
				//	2. 调用 openapi 获取设备列表，与本地存储做对比
				const httpConfig: IHttpConfig = {
					ip, at, path: EHttpPath.DEVICES, method: EMethod.GET
				}
				const openDeviceResp = await httpRequest(httpConfig);
				this.log.info('***** Get openapi devices *****', openDeviceResp);
				// if (openDeviceResp.error !== 0) {
				// 	this.handleHttpError(openDeviceResp.error)
				// 	return;
				// }
				//	3. 初始化Ihost配置类
				ihostConfig.handleConfig(config);
				//	3. 对比 openapi 设备和 配置文件设备
				// const filterDevices = this.handleDevice(openDeviceResp.data, devices)
				// this.log.info('***** handle devices *****', filterDevices);

			} catch (error) {
				this.log.warn('***** Unexpected error *****', error);
				return;
			}

			//	init server
			// this.initWs()
			// //	get IHost Device
			const devicess = Devices as IDevice[];

			//	transfer device 2 accessory
			for (let device of devicess) {
				this.transferDevice(device)
			}
		})
		this.api.on(APIEvent.SHUTDOWN, () => {
			//	close server
		})
	}
	//	处理 openapi设备 与 config.json配置文件中的设备 的对比，筛选出可以注册到hb的设备
	handleDevice(openDevices: IDevice[], devices: IDeviceConfig[]) {
		if (!devices || !devices.length) {
			return openDevices ?? []
		}
		const filterDevices = openDevices.map(device => {
			//	配置文件中不存在该设备，可以返回
			if (!JSON.stringify(devices).includes(device.serial_number)) {
				return device
			} else {
				//	配置文件中存在该设备，则根据选中情况来判定
				const temp = devices.find(item => item.serial_number === device.serial_number);
				if (!temp) return device
				if (temp && temp.checked) return device
			}
		})
		return filterDevices
	}

	configureAccessory(accessory: PlatformAccessory) {
		this.log.info('----Loading accessory from cache----', accessory.displayName);
		this.accessories.set(accessory.UUID, accessory);
	}
	transferDevice(device: IDevice) {
		let category = device.display_category;
		const uuid = this.api.hap.uuid.generate(device.serial_number);
		//	search cache accessory
		const cacheAccessory = this.accessories.get(uuid);
		let deviceAccessory: IBaseAccessory | undefined = undefined
		// TODO --> Map
		if (category === ECategory.SWITCH) {
			deviceAccessory = new DeviceType.switch_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.PLUG) {
			deviceAccessory = new DeviceType.outlet_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.LIGHT) {
			deviceAccessory = new DeviceType.light_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.SMOKE_DETECTOR) {
			deviceAccessory = new DeviceType.smoke_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.MOTION_SENSOR) {
			deviceAccessory = new DeviceType.motion_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.CONTACT_SENSOR) {
			deviceAccessory = new DeviceType.door_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.CURTAIN) {
			deviceAccessory = new DeviceType.curtain_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.TEMPERATURE_HUMIDITY_SENSOR) {
			deviceAccessory = new DeviceType.thermostat_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.BUTTON) {
			deviceAccessory = new DeviceType.button_accessory(this, cacheAccessory, device)
		}
		//	TODO
		if (deviceAccessory && typeof deviceAccessory.mountService === 'function') {
			deviceAccessory.mountService()
		}
		if (deviceAccessory && deviceAccessory.accessory) {
			this.accessories.set(uuid, deviceAccessory.accessory);
			this.formatAccessory.set(uuid, deviceAccessory);

			!cacheAccessory && this.registryAccesory(deviceAccessory.accessory);
		}
	}
	//	registry accessory to platform plugin
	registryAccesory(accessory: PlatformAccessory) {
		this.log.log(LogLevel.INFO, `add accessory ${accessory.displayName} ${accessory.UUID}`)
		this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
	}
	//	add accessory
	addAccessory(device: IDevice) {
		this.log.log(LogLevel.INFO, `add accessory ${device.name}`)
		this.transferDevice(device)
	}
	//	delete accessory
	deleteAccessory(accessory: PlatformAccessory) {
		this.log.log(LogLevel.INFO, `delete accessory ${accessory.displayName}`)
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
		this.accessories.delete(accessory.UUID);
		this.formatAccessory.delete(accessory.UUID);
	}


	initWs() {
		let url = 'ws://localhost:1880/hb';
		const socket = new WebSocket(url);
		socket.onopen = (event) => this.onopen();
		socket.onmessage = (event) => this.onmessage(event);
		socket.onerror = (event) => this.onerror(event)
	}
	onopen() {
		this.log.info('websocket open success')
	}
	onerror(ev: WebSocket.ErrorEvent) {
		this.log.info("🚀 onerror ~ ev", ev)
	}
	onmessage(ev: { data: any; type: string; target: any }) {
		const { data } = ev;
		const receiveMsg = JSON.parse(data) as { action: string, uuid: string, params: any };
		this.log.info(`receive message`, receiveMsg)
		switch (receiveMsg.action) {
			case 'add':
				break;
			case 'update':
				this.updateAccessory(receiveMsg.uuid, receiveMsg.params)
				break;
			case 'delete':
				const accessory = this.accessories.get(receiveMsg.uuid);
				if (accessory) {
					this.deleteAccessory(accessory)
				}
				break;
			case 'notify':
				this.log.info('this.accessories------>', this.accessories)
				this.log.info('this.formatAccessory----->', this.formatAccessory)
			default:
				break;
		}
	}
	updateAccessory(serial_number: string, params: any) {
		const uuid = this.api.hap.uuid.generate(serial_number);
		const accessory = this.formatAccessory.get(uuid)
		if (accessory && typeof accessory.updateValue === 'function') {
			accessory.updateValue(params)
		}
	}
	handleHttpError(error: number) {
		if (this.httpErrorMap.get(error)) {
			return this.httpErrorMap.get(error)
		}
		return 'unknown error'
	}
}
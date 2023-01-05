import { API, APIEvent, DynamicPlatformPlugin, Logger, LogLevel, PlatformAccessory, PlatformConfig, Service, Characteristic, Categories, uuid } from "homebridge";
import DeviceType from './accessory/index';
import { PLATFORM_NAME, PLUGIN_NAME } from "./config/platformConfig";
import Devices from './simulationDevice/index'
import { ECategory } from "./ts/enum/ECategory";
import { IBaseAccessory } from "./ts/interface/IBaseAccessory";
import { IDevice } from "./ts/interface/IDevice";
import { IPlatFormConfig, IDeviceConfig } from "./ts/interface/IPlatFormConfig";
import { IResponseDeviceObject, IUpdateDeviceState, IDeleteDevice } from './ts/interface/IEvent'
import WebSocket from 'isomorphic-ws';
import EventSource from 'eventsource'
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

	public event: EventSource | null = null

	constructor(public readonly log: Logger, public readonly config: IPlatFormConfig, public readonly api: API) {
		this.logManager(LogLevel.INFO, '----Finished initializing ihost platform config-----', this.config)
		this.api.on(APIEvent.DID_FINISH_LAUNCHING, async () => {
			this.logManager(LogLevel.INFO, '----Executed didFinishLaunching callback----')
			// return;
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
				this.logManager(LogLevel.INFO, '----Get openapi devices----', openDeviceResp)
				if (openDeviceResp.error !== 0) {
					this.handleHttpError(openDeviceResp.error)
					return;
				}
				//	3. 初始化Ihost配置类
				ihostConfig.handleConfig(config);
				//	3. 对比 openapi 设备和 配置文件设备
				const filterDevices = this.handleDevice(openDeviceResp.data.device_list, devices)
				this.logManager(LogLevel.INFO, '----handle devices----', filterDevices)

				if (!filterDevices.length) {
					this.logManager(LogLevel.WARN, '----No Avaliable Devices----', filterDevices)
					return
				}
				//	transfer device 2 accessory
				const devicess = Devices as IDevice[];

				for (let device of filterDevices) {
					this.transferDevice(device)
				}
			} catch (error) {
				this.logManager(LogLevel.WARN, '----Unexpected error----', error)
				return;
			}

			//	init server
			this.initWs()
			this.initSSE()
		})
		this.api.on(APIEvent.SHUTDOWN, () => {
			//	close server
			this.logManager(LogLevel.INFO, '----plugin shutdown----')
		})
	}
	//	处理 openapi设备 与 config.json配置文件中的设备 的对比，筛选出可以注册到hb的设备
	handleDevice(openDevices: IDevice[], devices: IDeviceConfig[]) {
		if (!devices || !devices.length || !openDevices) {
			return []
		}
		const finalDevice: IDevice[] = []
		openDevices.forEach(device => {
			//	配置文件中不存在该设备，可以返回
			if (!JSON.stringify(devices).includes(device.serial_number)) {
				finalDevice.push(device)
			} else {
				//	配置文件中存在该设备，则根据选中情况来判定
				const temp = devices.find(item => item.serial_number === device.serial_number);
				if (!temp) finalDevice.push(device)
				if (temp && temp.checked) finalDevice.push(device)
			}
		})
		// this.logManager(LogLevel.INFO, '----finalDevice----', JSON.stringify(finalDevice))
		//	get memory store accessories
		const accessoriesUIID = [...this.accessories.keys()];
		this.logManager(LogLevel.INFO, '----accessoriesUIID----', accessoriesUIID)

		// if openapi has not the device but memory has, delete the device
		// get final devices serial_number array
		const finalDeviceUUIDArray: string[] = finalDevice.map(item => {
			return this.api.hap.uuid.generate(item.serial_number)
		})
		this.logManager(LogLevel.INFO, '----finalDeviceUUIDArray----', finalDeviceUUIDArray)
		accessoriesUIID.forEach(uuid => {
			if (!finalDeviceUUIDArray.includes(uuid)) {
				const accessory = this.accessories.get(uuid);
				accessory && this.deleteAccessory(accessory)
			}
		})
		return finalDevice
	}

	configureAccessory(accessory: PlatformAccessory) {
		this.logManager(LogLevel.INFO, '----Loading accessory from cache----', accessory.displayName)
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
		} else if (category === ECategory.WATER_LEAK_DETECTOR) {
			deviceAccessory = new DeviceType.water_detector_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.MOTION_SENSOR) {
			deviceAccessory = new DeviceType.motion_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.CONTACT_SENSOR) {
			deviceAccessory = new DeviceType.door_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.CURTAIN) {
			deviceAccessory = new DeviceType.curtain_accessory(this, cacheAccessory, device)
		} else if (category === ECategory.TEMPERATURE_HUMIDITY_SENSOR
			|| category === ECategory.TEMPERATURE_SENSOR
			|| category === ECategory.HUMIDITY_SENSOR) {
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
		this.logManager(LogLevel.INFO, `add accessory ${accessory.displayName} ${accessory.UUID}`)
		this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
	}
	//	add accessory
	addAccessory(device: IDevice) {
		this.logManager(LogLevel.INFO, `add accessory ${device.name}`)
		this.transferDevice(device)
	}
	//	delete accessory
	deleteAccessory(accessory: PlatformAccessory) {
		this.logManager(LogLevel.INFO, `delete accessory ${accessory.displayName}`)
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
		this.accessories.delete(accessory.UUID);
		this.formatAccessory.delete(accessory.UUID);
	}

	initSSE() {
		const url = `http://${ihostConfig.ip}/${EHttpPath.SSE}?access_token=${ihostConfig.at}`
		try {
			this.event = new EventSource(url);
			this.event.onopen = (event) => {
				this.logManager(LogLevel.INFO, 'init sse success', event)
			}
			this.event.onerror = (event) => {
				this.logManager(LogLevel.ERROR, 'init sse error', event)
			}
			this.event.addEventListener('device#v1#addDevice', (event) => {
				const { payload } = JSON.parse(event.data) as IResponseDeviceObject;
				this.addAccessory(payload)
			})
			this.event.addEventListener('device#v1#updateDeviceState', (event) => {
				const { endpoint: { serial_number }, payload } = JSON.parse(event.data) as IUpdateDeviceState;
				this.updateAccessory(serial_number, payload, true)
			})
			this.event.addEventListener('device#v1#deleteDevice', (event) => {
				const { endpoint: { serial_number } } = JSON.parse(event.data) as IDeleteDevice;
				const uuid = this.api.hap.uuid.generate(serial_number);
				const accessory = this.accessories.get(uuid);
				if (accessory) {
					this.deleteAccessory(accessory)
				}
			})
		} catch (error) {
			this.logManager(LogLevel.ERROR, 'catch init sse error', error)
		}
	}
	clearSSE() {
		try {
			this.event?.removeEventListener('device#v1#addDevice', () => { })
			this.event?.removeEventListener('device#v1#updateDeviceState', () => { })
			this.event?.removeEventListener('device#v1#deleteDevice', () => { })
			this.event?.close()
		} catch (error) {
			this.logManager(LogLevel.ERROR, 'catch clear sse error', error)
		}
	}
	initWs() {
		let url = 'ws://localhost:1880/hb';
		const socket = new WebSocket(url);
		socket.onmessage = (event) => this.onmessage(event);
	}
	onmessage(ev: { data: any; type: string; target: any }) {
		const { data } = ev;
		const receiveMsg = JSON.parse(data) as { action: string, serial_number: string, params: any };
		this.log.info(`receive message`, receiveMsg)
		switch (receiveMsg.action) {
			case 'add':
				break;
			case 'update':
				this.updateAccessory(receiveMsg.serial_number, receiveMsg.params, true)
				break;
			case 'delete':
				const uuid = this.api.hap.uuid.generate(receiveMsg.serial_number);
				const accessory = this.accessories.get(uuid);
				this.log.info(`delete`, accessory?.displayName)
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
	updateAccessory(serial_number: string, params?: any, fullState = false) {
		const uuid = this.api.hap.uuid.generate(serial_number);
		const accessory = this.formatAccessory.get(uuid)
		if (accessory && typeof accessory.updateValue === 'function') {
			if (!params) {
				accessory.updateValue()
				return;
			}
			//	receive sse msg, update the device all state
			if (fullState) {
				accessory.device.state = params
			} else {
				//	hb control device, change the device state
				if (!params.toggle) {
					Object.assign(accessory.device.state, params)
				} else {
					const toggleItem = params['toggle'];
					Object.assign(accessory.device.state['toggle'], toggleItem)
				}
			}
			accessory.updateValue(fullState)

			// const { state } = accessory.device;
			// let deviceState = state;
			// const stateArr = Object.keys(state);
			// if (!stateArr.length) {
			// 	accessory.device.state = params;
			// 	return;
			// }
			// stateArr.forEach(key => {
			// 	const stateItem = params[key]
			// 	if (stateItem) {
			// 		if (key === 'toggle') {
			// 			Object.assign(deviceState['toggle'], stateItem)
			// 		} else {
			// 			deviceState[key] = stateItem
			// 		}
			// 	}

			// })
			// accessory.device.state = deviceState
			// this.log.info('updateAccessory---->', deviceState)
			// this.log.info('updateAccessory---->', accessory.device.state)
			// accessory.updateValue(deviceState)
		}
	}
	handleHttpError(error: number) {
		if (this.httpErrorMap.get(error)) {
			return this.httpErrorMap.get(error)
		}
		return 'unknown error'
	}
	logManager(logLevel: LogLevel, message: string, ...parameters: any[]) {
		ihostConfig.enableDeviceLog && this.log.log(logLevel, message, ...parameters)
	}
}
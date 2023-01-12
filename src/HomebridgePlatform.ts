import { API, APIEvent, DynamicPlatformPlugin, Logger, LogLevel, PlatformAccessory, Service, Characteristic } from "homebridge";
import DeviceType from './accessory/index';
import { PLATFORM_NAME, PLUGIN_NAME } from "./config/platformConfig";
import Devices from './simulationDevice/index'
import { ECategory } from "./ts/enum/ECategory";
import { IBaseAccessory } from "./ts/interface/IBaseAccessory";
import { IDevice } from "./ts/interface/IDevice";
import { IPlatFormConfig, IDeviceConfig } from "./ts/interface/IPlatFormConfig";
import { IResponseDeviceObject, IUpdateDeviceState, IDeleteDevice, IUpdateDeviceOnline } from './ts/interface/IEvent'
import EventSource from 'eventsource'
import { IHttpConfig } from "./ts/interface/IHttpConfig";
import { EHttpPath } from "./ts/enum/EHttpPath";
import { EMethod } from "./ts/enum/EMethod";
import httpRequest from "./service/httpRequest";
import ihostConfig from "./config/IhostConfig";
import deviceUtils from "./utils/deviceUtils";

const categoryAccessoryMap = new Map<string[], any>([
    [[ECategory.SWITCH], DeviceType.switch_accessory],
    [[ECategory.PLUG], DeviceType.outlet_accessory],
    [[ECategory.LIGHT], DeviceType.light_accessory],
    [[ECategory.SMOKE_DETECTOR], DeviceType.smoke_accessory],
    [[ECategory.WATER_LEAK_DETECTOR], DeviceType.water_detector_accessory],
    [[ECategory.MOTION_SENSOR], DeviceType.motion_accessory],
    [[ECategory.CONTACT_SENSOR], DeviceType.door_accessory],
    [[ECategory.CURTAIN], DeviceType.curtain_accessory],
    [[ECategory.TEMPERATURE_HUMIDITY_SENSOR, ECategory.TEMPERATURE_SENSOR, ECategory.HUMIDITY_SENSOR], DeviceType.thermostat_accessory],
    [[ECategory.BUTTON], DeviceType.button_accessory]
]);

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
		// this.logManager(LogLevel.INFO, '----Finished initializing ihost platform config-----', this.config)
		this.api.on(APIEvent.DID_FINISH_LAUNCHING, async () => {
			//	init ihost config
			ihostConfig.handleConfig(config);
			this.logManager(LogLevel.INFO, '----Executed didFinishLaunching callback----')

			const { ihost = {} } = this.config
			const { ip = '', at = '', devices = [] } = ihost

			//	1. confirm avaliable ip at
			if (!ip || !at) {
				this.logManager(LogLevel.WARN, '----No avaliable ihost! Please check the config.json----')
				return;
			}

			try {
				//	init sse server
				this.initSSE()
				//	2. get ihost openapi devices
				const httpConfig: IHttpConfig = {
					ip, at, path: EHttpPath.DEVICES, method: EMethod.GET
				}
				const openDeviceResp = await this.getIhostDevices(httpConfig);
				this.logManager(LogLevel.INFO, '----Get openapi devices----', openDeviceResp)
				if (openDeviceResp.error !== 0) {
					this.handleHttpError(openDeviceResp.error)
					return;
				}
				//	3. handle ihost devices and other config
				const filterDevices = this.handleDevice(openDeviceResp.data.device_list, devices)
				this.logManager(LogLevel.INFO, '----handle devices----', filterDevices)

				if (!filterDevices.length) {
					this.logManager(LogLevel.WARN, '----No Avaliable Devices----', filterDevices)
					return
				}
				//	4. transfer device 2 accessory
				for (let device of filterDevices) {
					this.transferDevice(device)
				}
			} catch (error) {
				this.logManager(LogLevel.WARN, '----Unexpected error----', error)
				return;
			}

		})
		this.api.on(APIEvent.SHUTDOWN, () => {
			//	close server
			this.logManager(LogLevel.INFO, '----plugin shutdown----')
			try {
				this.clearSSE()
			} catch (error) {

			}
		})
	}
	// get ihost openapi devices
	async getIhostDevices(httpConfig: IHttpConfig) {
		try {
			const resp = await httpRequest(httpConfig);
			return resp
		} catch (error) {
			return {
				error: 1000,
				data: {
					device_list: []
				}
			}
		}
	}
	//	处理 openapi设备 与 config.json配置文件中的设备 的对比，筛选出可以注册到hb的设备
	handleDevice(openDevices: IDevice[], devices: IDeviceConfig[]) {
		if (!openDevices || !openDevices.length) {
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
		//	get memory store accessories
		const accessoriesUIID = [...this.accessories.keys()];
		// this.logManager(LogLevel.INFO, '----accessoriesUIID----', accessoriesUIID)

		// if openapi has not the device but memory has, delete the device
		// get final devices serial_number array
		const finalDeviceUUIDArray: string[] = finalDevice.map(item => {
			return this.api.hap.uuid.generate(item.serial_number)
		})
		accessoriesUIID.forEach(uuid => {
			if (!finalDeviceUUIDArray.includes(uuid)) {
				const accessory = this.accessories.get(uuid);
				accessory && this.deleteAccessory(accessory)
			}
		})
		return finalDevice
	}

	configureAccessory(accessory: PlatformAccessory) {
		// this.logManager(LogLevel.INFO, '----Loading accessory from cache----', accessory.displayName)
		this.accessories.set(accessory.UUID, accessory);
	}
	transferDevice(device: IDevice) {
		deviceUtils.setDeviceName(device);
		let category = device.display_category;
		const uuid = this.api.hap.uuid.generate(device.serial_number);
		//	search cache accessory
		const cacheAccessory = this.accessories.get(uuid);
		let deviceAccessory: IBaseAccessory | undefined = undefined
        for (let categoryArr of categoryAccessoryMap.keys()) {
            if (categoryArr.includes(category)) {
                const accessory = categoryAccessoryMap.get(categoryArr)
                deviceAccessory = new accessory(this, cacheAccessory, device)
                break
            }
        }
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
		deviceUtils.setDeviceName(device)
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
		const url = `http://${ihostConfig.ip}${EHttpPath.SSE}?access_token=${ihostConfig.at}`
		// this.logManager(LogLevel.INFO, 'sse url', url)
		try {
			this.event = new EventSource(url);
			this.event.onopen = (event) => {
				this.logManager(LogLevel.INFO, 'init sse success', event)
			}
			this.event.onerror = (event) => {
				this.logManager(LogLevel.ERROR, 'init sse error', event)
			}
			this.event.addEventListener('device#v1#addDevice', (event) => {
				this.logManager(LogLevel.INFO, 'add device by sse', JSON.stringify(event))
				const { payload } = JSON.parse(event.data) as IResponseDeviceObject;
				this.addAccessory(payload)
			})
			this.event.addEventListener('device#v1#updateDeviceState', (event) => {
				this.logManager(LogLevel.INFO, 'update device state by sse', JSON.stringify(event))
				const { endpoint: { serial_number }, payload } = JSON.parse(event.data) as IUpdateDeviceState;
				this.updateAccessory(serial_number, payload, true)
			})
			this.event.addEventListener('device#v1#updateDeviceOnline', (event) => {
				this.logManager(LogLevel.INFO, 'update device online by sse', JSON.stringify(event))
				const { endpoint: { serial_number }, payload } = JSON.parse(event.data) as IUpdateDeviceOnline;
				this.updateAccessory(serial_number, payload)
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
			this.event?.removeEventListener('device#v1#updateDeviceOnline', () => { })
			this.event?.removeEventListener('device#v1#deleteDevice', () => { })
			this.event?.close()
		} catch (error) {
			this.logManager(LogLevel.ERROR, 'catch clear sse error', error)
		}
	}

	updateAccessory(serial_number: string, params?: any, sse = false) {
		const uuid = this.api.hap.uuid.generate(serial_number);
		const accessory = this.formatAccessory.get(uuid)
		if (accessory && typeof accessory.updateValue === 'function') {
			// this.logManager(LogLevel.INFO, 'update ---- >', params)
			try {
				if (!params) {
					accessory.updateValue()
					return;
				}
				//	online judge
				if (params.hasOwnProperty('online')) {
					Object.assign(accessory.device, params)
				} else if (!params.toggle) {
					//	hb control device, change the device state
					Object.assign(accessory.device.state, params)
				} else {
					const toggleItem = params['toggle'];
					if (!accessory.device.state['toggle']) {
						accessory.device.state.toggle = {}
					}
					Object.assign(accessory.device.state['toggle'], toggleItem)
				}
				accessory.updateValue(sse)
			} catch (error) {

			}
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
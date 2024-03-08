import { API, APIEvent, DynamicPlatformPlugin, Logger, LogLevel, PlatformAccessory, Service, Characteristic } from "homebridge";
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
import { base_accessory } from "./accessory/base_accessory";
import { get, isNull, merge } from "lodash";
import IRFBridgeInfo from "./ts/interface/IRFBridgeInfo";
import { rf_button_accessory } from "./accessory/rf_button_accessory";
import { rf_curtain_accessory } from "./accessory/rf_curtain_accessory";
import { switch_accessory } from "./accessory/switch_accessory";

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
        this.api.on(APIEvent.DID_FINISH_LAUNCHING, async () => {
            //	init ihost config
            ihostConfig.handleConfig(config);
            this.log.info('----Executed didFinishLaunching callback----')

            const { ihost = {} } = this.config
            const { ip = '', at = '', devices = [] } = ihost

            //	1. confirm available ip at
            if (!ip || !at) {
                this.log.warn('----No available ihost! Please check the config.json----')
                return;
            }

            try {
                //	init sse server
                const initRes = await this.initSSE()
                if (!initRes) return;
                //	2. get ihost open api devices
                const httpConfig: IHttpConfig = {
                    ip: ihostConfig.ip, at, path: EHttpPath.DEVICES, method: EMethod.GET
                }
                const openDeviceResp = await this.getIhostDevices(httpConfig);
                // this.logManager(LogLevel.INFO, '----Get open api devices----', openDeviceResp)
                if (openDeviceResp.error !== 0) {
                    this.handleHttpError(openDeviceResp.error)
                    return;
                }
                //	3. handle ihost devices and other config
                const filterDevices = this.handleDevice(openDeviceResp.data.device_list, devices)
                this.logManager(LogLevel.INFO, '----handle devices----', JSON.stringify(filterDevices))

                if (!filterDevices.length) {
                    this.log.warn('----No Avaliable Devices----')
                    return
                }
                //	4. transfer device 2 accessory
                for (let device of filterDevices) {
                    this.transferDevice(device)
                }
            } catch (error) {
                this.log.warn('----Unexpected error----', error)
                return;
            }

        })
        this.api.on(APIEvent.SHUTDOWN, () => {
            //	close server
            this.log.info('----plugin shutdown----')
            try {
                this.clearSSE()
            } catch (error) {
                this.log.warn('----plugin shutdown error----', error)
                return;
            }
        })
    }
    // get ihost open api devices
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
    //	handle open api devices, compare with config.json devices, filter devices registry to hb
    handleDevice(openDevices: IDevice[], devices: IDeviceConfig[]) {
        if (!openDevices || !openDevices.length) {
            return []
        }
        const finalDevice: IDevice[] = []
        openDevices.forEach(device => {
            //	配置文件中不存在该设备，可以返回
            //	config.json not exist
            if (!JSON.stringify(devices).includes(device.serial_number)) {
                finalDevice.push(device)
            } else {
                // config.json exist the device, depends on the checked status
                const temp = devices.find(item => item.serial_number === device.serial_number);
                if (!temp) finalDevice.push(device)
                if (temp && temp.checked) finalDevice.push(device)
            }
        })
        //	get memory store accessories
        const accessoriesUIID = [...this.accessories.keys()];

        // if open api has not the device but memory has, delete the device
        // get final devices serial_number array
        const finalDeviceUUIDArray: string[] = finalDevice.map(item => {
            return this.api.hap.uuid.generate(item.serial_number)
        })
        accessoriesUIID.forEach(uuid => {
            if (!finalDeviceUUIDArray.includes(uuid)) {
                const accessory = this.accessories.get(uuid);
                accessory && this.deleteOneAccessory(accessory)
            }
        })
        return finalDevice
    }

    configureAccessory(accessory: PlatformAccessory) {
        // this.logManager(LogLevel.INFO, '----Loading accessory from cache----', accessory.displayName)
        this.accessories.set(accessory.UUID, accessory);
    }
    transferDevice(device: IDevice) {

        // rf bridge need special care
        if (deviceUtils.isRfBridge(device)) {
            deviceUtils.setDeviceName(device);
            const rfGatewayConfig = get(device, ['tags', '_smartHomeConfig', 'rfGatewayConfig'], null) as IRFBridgeInfo | null;
            if (!rfGatewayConfig) return;

            const { type, buttonInfoList } = rfGatewayConfig;

            const MULTI_CHL_BTN = ['1', '2', '3', '4'];
            const CURTAIN = '5';


            if (MULTI_CHL_BTN.includes(type)) {
                this.transferDeviceByAccessory(device, rf_button_accessory);
                return;
            }

            // rf curtain need to be display as separate devices 
            if (type === CURTAIN) {
                try {
                    for (const buttonInfo of buttonInfoList) {
                        const uuid = this.api.hap.uuid.generate(`${device.serial_number}_curtain_${buttonInfo.rfChl}`);
                        const cacheAccessory = this.accessories.get(uuid);
                        const deviceAccessory: IBaseAccessory = new rf_curtain_accessory(this, cacheAccessory, device, buttonInfo.rfChl)
                        if (typeof deviceAccessory.mountService === 'function') {
                            deviceAccessory.mountService()
                        }
                        if (deviceAccessory.accessory) {
                            this.accessories.set(uuid, deviceAccessory.accessory);
                            this.formatAccessory.set(uuid, deviceAccessory);

                            !cacheAccessory && this.registryAccessory(deviceAccessory.accessory);
                        }
                    }
                } catch (error) {
                    console.error("curtain init error", error);
                }

                return;
            }
        }

        // normal device
        const accessory = deviceUtils.getAccessoryByCategory(device)
        if (!accessory) return;
        this.transferDeviceByAccessory(device, accessory);
    }
    transferDeviceByAccessory(device: IDevice, accessory: any) {
        deviceUtils.setDeviceName(device);

        const uuid = this.api.hap.uuid.generate(device.serial_number);
        const cacheAccessory = this.accessories.get(uuid);
        const deviceAccessory: IBaseAccessory = new accessory(this, cacheAccessory, device)
        if (typeof deviceAccessory.mountService === 'function') {
            deviceAccessory.mountService()
        }

        if (deviceAccessory.accessory) {
            this.accessories.set(uuid, deviceAccessory.accessory);
            this.formatAccessory.set(uuid, deviceAccessory);

            !cacheAccessory && this.registryAccessory(deviceAccessory.accessory);
        }
    }
    //	registry accessory to platform plugin
    registryAccessory(accessory: PlatformAccessory) {
        this.log.info(`add accessory ${accessory.displayName} ${accessory.UUID} ${PLATFORM_NAME} ${PLATFORM_NAME} ${accessory}`)
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
    //	add accessory
    addAccessory(device: IDevice) {
        // deviceUtils.setDeviceName(device)
        this.transferDevice(device);
    }
    //	delete accessory
    deleteAccessory(serial_number: string) {
        let UUIDSn = "";
        for (const [key, value] of this.formatAccessory.entries()) {
            if (value.device.serial_number !== serial_number) continue;

            // rf bridge curtain need to be treated separately
            if (deviceUtils.isRfBridge(value.device)) {
                const rfGatewayConfig = get(value.device, ['tags', '_smartHomeConfig', 'rfGatewayConfig'], null) as IRFBridgeInfo | null;

                if (!rfGatewayConfig) continue;
                const { type, buttonInfoList } = rfGatewayConfig
                if (type === '5') {
                    buttonInfoList.forEach(buttonInfo => {
                        const sn = `${serial_number}_curtain_${buttonInfo.rfChl}`;
                        const uuid = this.api.hap.uuid.generate(sn);
                        const accessory = this.accessories.get(uuid);
                        if (!accessory) return;
                        this.deleteOneAccessory(accessory);
                    })
                } else {
                    UUIDSn = serial_number;
                }

                break;
            } else {
                UUIDSn = serial_number;
                break;
            }
        }
        const uuid = this.api.hap.uuid.generate(UUIDSn);
        const accessory = this.accessories.get(uuid);
        if (!accessory) return;
        this.deleteOneAccessory(accessory);
    }

    deleteOneAccessory(accessory: PlatformAccessory) {
        this.log.info(`delete accessory ${accessory.displayName}`)
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
        this.accessories.delete(accessory.UUID);
        this.formatAccessory.delete(accessory.UUID);
    }

    public async initSSE() {
        return new Promise(resolve => {
            const url = `http://${ihostConfig.ip}${EHttpPath.SSE}?access_token=${ihostConfig.at}`
            try {
                this.event = new EventSource(url);
                this.event.onopen = (event) => {
                    this.logManager(LogLevel.INFO, 'init sse success', event);
                    resolve(true);
                }
                this.event.onerror = async (event) => {
                    this.logManager(LogLevel.ERROR, 'init sse error', event)
                    const res = await base_accessory.prototype.retryForDomain();
                    if (res!.error === 0) {
                        this.clearSSE();
                        // reconnect sse
                        await this.initSSE();
                    }
                    resolve(true);
                }
                this.event.addEventListener('device#v1#addDevice', (event) => {
                    const { payload } = JSON.parse(event.data) as IResponseDeviceObject;
                    this.addAccessory(payload)
                })
                this.event.addEventListener('device#v1#updateDeviceState', (event) => {
                    this.logManager(LogLevel.INFO, 'receive sse message', event ? event.data : {})
                    const { endpoint: { serial_number }, payload } = JSON.parse(event.data) as IUpdateDeviceState;
                    this.updateAccessory(serial_number, payload, true)
                })
                this.event.addEventListener('device#v1#updateDeviceOnline', (event) => {
                    const { endpoint: { serial_number }, payload } = JSON.parse(event.data) as IUpdateDeviceOnline;
                    this.updateAccessory(serial_number, payload)
                })
                this.event.addEventListener('device#v1#deleteDevice', (event) => {
                    const { endpoint: { serial_number } } = JSON.parse(event.data) as IDeleteDevice;
                    this.deleteAccessory(serial_number);
                })
            } catch (error) {
                this.logManager(LogLevel.ERROR, 'catch init sse error', error);
                resolve(false)
            }
        })
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
        let UUIDSn = "";
        for (const [key, value] of this.formatAccessory.entries()) {
            if (value.device.serial_number !== serial_number) continue;

            // rf bridge curtain need to be treated separately
            if (deviceUtils.isRfBridge(value.device)) {
                const rfGatewayConfig = get(value.device, ['tags', '_smartHomeConfig', 'rfGatewayConfig'], null) as IRFBridgeInfo | null;
                const rfCurtainChl = get(value, ['extra', 'rfCurtainChl']);

                if (!rfGatewayConfig) continue;
                if (rfGatewayConfig.type === '5') {
                    const press = get(params, ['press', 'press'], null);
                    UUIDSn = isNull(press) ? `${serial_number}_curtain_${rfCurtainChl}` : `${serial_number}_curtain_${press}`
                } else {
                    UUIDSn = serial_number;
                }
                break;
            } else {
                UUIDSn = serial_number;
                break;
            }
        }



        const uuid = this.api.hap.uuid.generate(UUIDSn);
        const accessory = this.formatAccessory.get(uuid)
        if (accessory && typeof accessory.updateValue === 'function') {
            this.updateOneAccessory(accessory, params, sse);
        }
    }
    updateOneAccessory(accessory: IBaseAccessory, params: any, sse: boolean) {
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
                merge(accessory.device.state, params);
            } else {
                const toggleItem = params['toggle'];
                if (!accessory.device.state['toggle']) {
                    accessory.device.state.toggle = {}
                }
                Object.assign(accessory.device.state['toggle'], toggleItem)
            }
            new accessory.platform.api.hap.HapStatusError(accessory.platform.api.hap.HAPStatus.SUCCESS);
            accessory.updateValue(sse)
        } catch (error) {
            this.logManager(LogLevel.INFO, "updateAccessory error", error);
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
import { ECapability } from '../ts/enum/ECapability';
import { IDevice } from '../ts/interface/IDevice';
import _, { find, get } from 'lodash';
import colorConvertUtils from './colorConvertUtils';
import { ECategory } from '../ts/enum/ECategory';
import DeviceType from './../accessory/index';


//	get multi channels devices config
function getMultiDeviceChannel(device: IDevice) {
    const { capabilities } = device;
    if (!capabilities.length) return [];
    const channelInfo: {
        name: string;
        value: string;
    }[] = [];
    capabilities.forEach((cap) => {
        if (cap.capability === ECapability.TOGGLE) {
            const channelName = _.get(device.tags, ['toggle', cap.name!]);
            if (!channelName) {
                channelInfo.push({
                    name: `channel_${cap.name!}`,
                    value: cap.name!
                });
            } else {
                channelInfo.push({
                    name: channelName,
                    value: cap.name!
                });
            }
        }
    });

    return channelInfo;
}

//	get multi press devices config
function getMultiPressDeviceChannel(device: IDevice) {
    const { capabilities } = device;
    if (!capabilities.length) return [];
    const channelInfo: {
        name: string;
        value: string;
    }[] = [];
    capabilities.forEach((cap) => {
        if (cap.capability === ECapability.MULTI_PRESS) {
            const channelName = _.get(device.tags, ['press', cap.name!]);
            if (!channelName) {
                channelInfo.push({
                    name: `press_${cap.name!}`,
                    value: cap.name!
                });
            } else {
                channelInfo.push({
                    name: channelName,
                    value: cap.name!
                });
            }
        }
    });

    return channelInfo;
}

//	according to the device abilities to mount services 
function renderServiceByCapability(device: IDevice, capability: ECapability) {
    const { capabilities = [] } = device;
    if (!capabilities.length) return false;
    return capabilities.some((item) => item.capability === capability);
}

/**
 * get update device code
 * power => powerState
 * toggle => toggleState
 * { toggle: { "1": { toggleState: "on" }, "2": { toggleState: "on" } } }
 * brightness =>  brightness
 * color-temperature => colorTemperature
 * color-rgb => { r: 255,g: 255,b: 255 }
 * percentage => percentage
 * 
 */
const deviceCapaStateMap = new Map<
    ECapability, {
        getter: (params: any) => any,
        getDeviceSend?: (params: any) => any
    }>([
        [ECapability.POWER, {
            getter: (params) => {
                const { device } = params as { device: IDevice };
                return _.get(device, ['state', 'power', 'powerState'], 'off') === 'on'
            },
            getDeviceSend: (params) => {
                const { value = false } = params;
                return {
                    'power': {
                        "powerState": value ? 'on' : 'off'
                    }
                }
            },
        }],
        [ECapability.TOGGLE, {
            getter: (params) => {
                const { device, index } = params as { device: IDevice, index: number }
                return _.get(device, ['state', 'toggle', `${index + 1}`, 'toggleState'], 'off') === 'on'
            },
            getDeviceSend: (params) => {
                const { value, index } = params
                return {
                    "toggle": {
                        [`${index + 1}`]: {
                            toggleState: value ? 'on' : 'off'
                        }
                    }
                }
            },
        }],
        [ECapability.BRIGHTNESS, {
            getter: (params) => {
                const { device } = params as { device: IDevice, index: string }
                return _.get(device, ['state', 'brightness', 'brightness'], 1)
            },
            getDeviceSend: (params) => {
                const { value = 1 } = params;
                return {
                    "brightness": {
                        "brightness": value
                    }
                }
            },
        }],
        [ECapability.COLOR_TEMPERATURE, {
            getter: (params) => {
                const { device } = params as { device: IDevice, index: string }
                const value = _.get(device, ['state', 'color-temperature', 'colorTemperature'], 0)
                return !value ? 500 : 500 - Math.round(value * 3.6)
            },
            getDeviceSend: (params) => {
                const { value = 140 } = params;
                return {
                    "color-temperature": {
                        "colorTemperature": Math.round((500 - value) / 3.6)
                    }
                }
            },
        }],
        [ECapability.COLOR_RGB, {
            getter: (params) => {
                const { device } = params as { device: IDevice }
                const { red, green, blue } = _.get(device, ['state', 'color-rgb'], { red: 255, green: 0, blue: 0 })
                return colorConvertUtils.rgb2hsv([red, green, blue])
            },
            getDeviceSend: (params) => {
                const { h, s, v } = params;
                const [r, g, b] = colorConvertUtils.hsv2rgb([h, s, v])
                return {
                    "color-rgb": {
                        red: r,
                        green: g,
                        blue: b
                    }
                }
            },
        }],
        [ECapability.PERCENTAGE, {
            getter: (params) => {
                const { device } = params as { device: IDevice }
                const percentage = _.get(device, ['state', 'percentage', 'percentage'], 0)
                return Math.abs(100 - percentage)
            },
            getDeviceSend(params) {
                const { value = 1 } = params
                return {
                    "percentage": {
                        "percentage": Math.abs(100 - value)
                    }
                }
            },
        }],
        [ECapability.BATTERY, {
            getter: (params) => {
                const { device } = params as { device: IDevice }
                const battery = _.get(device, ['state', 'battery', 'battery'], -1)
                return battery !== -1 ? battery : 0
            },
        }],
        [ECapability.DETECT, {
            getter: (params) => {
                const { device } = params as { device: IDevice }
                return _.get(device, ['state', 'detect', 'detected'], false)
            },
        }],
        [ECapability.HUMIDITY, {
            getter: (params) => {
                const { device } = params as { device: IDevice }
                const humidity = _.get(device, ['state', 'humidity', 'humidity'], '--')
                if (humidity === '--' || _.isInteger(humidity)) return humidity;
                return humidity.toFixed(1)
            },
        }],
        [ECapability.TEMPERATURE, {
            getter: (params) => {
                const { device } = params as { device: IDevice }
                const temperature = _.get(device, ['state', 'temperature', 'temperature'], '--')
                if (temperature === '--') return temperature;
                return temperature.toFixed(1)
            },
        }],
        [ECapability.PRESS, {
            getter: (params) => {
                const { device } = params as { device: IDevice }
                const pressKey = _.get(device, ['state', 'press', 'press'], 'singlePress')
                return pressKey === 'singlePress' ? 0 : pressKey === 'doublePress' ? 1 : 2
            },
            getDeviceSend(params) {
                const { index = "0" } = params;
                return {
                    "press": {
                        "press": index
                    }
                }
            }
        }],
        [ECapability.MODE, {
            getter: (params) => {
                const { device } = params as { device: IDevice }

                if (device.display_category === ECategory.FAN_LIGHT) {
                    return _.get(device, ['state', 'mode', 'fanLevel', 'modeValue'], 'low')
                }

                return "";
            },
            getDeviceSend(params) {
                const { value, category } = params;
                if (category === ECategory.FAN_LIGHT) {
                    const fanLightParams = getFanLightUpdateParams({ type: 'fanSpeedNum', payload: value });
                    return {
                        "mode": {
                            "fanLevel": {
                                modeValue: fanLightParams!.payload
                            }
                        }
                    }
                }
            }
        }],
        [ECapability.MULTI_PRESS, {
            getter: (params) => {
                const { device, index } = params as { device: IDevice, index: number }
                const pressKey = _.get(device, ['state', 'multi-press', `${index + 1}`, 'press'], 'singlePress')
                return pressKey === 'singlePress' ? 0 : pressKey === 'doublePress' ? 1 : 2
            }
        }],
    ])

function getDeviceStateByCap(capability: ECapability, device: IDevice, index?: number) {
    const { capabilities = [] } = device;
    let deviceState: any = '';
    capabilities.forEach((item) => {
        if (item.capability === capability) {
            deviceState = deviceCapaStateMap.get(capability)?.getter({ device, index })
        }
    })
    return deviceState
}
function getDeviceSendState(capability: ECapability, params: any) {
    const stateConfigGetter = deviceCapaStateMap.get(capability)?.getDeviceSend;
    if (typeof stateConfigGetter !== 'function') {
        return {}
    }
    return {
        state: stateConfigGetter(params)
    }
}

/**
 * default device name
 */
function setDeviceName(device: IDevice) {
    !device.name && (device.name = device.manufacturer + ' ' + device.display_category)
}

/** mapping of category to accessory */
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
    [[ECategory.BUTTON], DeviceType.button_accessory],
    [[ECategory.FAN_LIGHT], DeviceType.fan_light_accessory]
]);

/** get accessory by category */
function getAccessoryByCategory(device: IDevice) {
    for (let categoryArr of categoryAccessoryMap.keys()) {
        if (categoryArr.includes(device.display_category)) {
            return categoryAccessoryMap.get(categoryArr);
        }
    }
}


type TTransferMapping = IFanSpeedLevel | IFanSpeedNum;

interface IFanSpeedLevel {
    type: 'fanSpeedLevel';
    payload: string;
}

interface IFanSpeedNum {
    type: 'fanSpeedNum';
    payload: number;
}

function getFanLightUpdateParams(params: TTransferMapping): TTransferMapping | null {
    const { type, payload } = params;
    const FAN_MODE_MAPPING = [
        {
            desc: 'low',
            num: [1, 33]
        },
        {
            desc: 'medium',
            num: [34, 66]
        },
        {
            desc: 'high',
            num: [67, 100]
        }
    ]

    if (type === 'fanSpeedLevel') {
        const mode = find(FAN_MODE_MAPPING, { desc: payload });
        if (!mode) return null;
        return {
            type: 'fanSpeedNum',
            payload: mode.num[1]
        }
    } else {
        const mode = find(FAN_MODE_MAPPING, (item) => payload <= item.num[1] && payload >= item.num[0]);
        if (!mode) return null;
        return {
            type: 'fanSpeedLevel',
            payload: mode.desc
        }
    }
}



/** is rf bridge */
function isRfBridge(device: IDevice): boolean {
    const { capabilities } = device;
    const pressItem = capabilities.find((item) => {
        return item.capability === ECapability.PRESS && item.permission === "readWrite";
    });
    return !!pressItem;
}


export default {
    getMultiDeviceChannel,
    renderServiceByCapability,
    getDeviceStateByCap,
    getDeviceSendState,
    setDeviceName,
    getAccessoryByCategory,
    getFanLightUpdateParams,
    isRfBridge,
    getMultiPressDeviceChannel
};
import { ECapability } from '../ts/enum/ECapability';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import _ from 'lodash';
import colotConvertUtils from './colotConvertUtils';

//	获取多通道设备的通道数据
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

//	根据设备能力判断是否挂载相应服务
function renderServiceByCapability(device: IDevice, capability: ECapability) {
	const { capabilities = [] } = device;
	if (!capabilities.length) return false;
	return capabilities.some((item) => item.capability === capability);
}

// const DeviceStateMap = new Map<keyof IDeviceState, (device: IDevice) => any>([
// 	[
// 		'online',
// 		(device: IDevice) => _.get(device, 'online', false)
// 	],
// 	[
// 		'switch',
// 		(device: IDevice) => _.get(device, ['state', 'powerState'], 'off') === 'on'
// 	],
// 	[
// 		'switch_0',
// 		(device: IDevice) => _.get(device, ['state', 'toggle', '1', 'toggleState'], 'off') === 'on'
// 	],
// 	[
// 		'switch_1',
// 		(device: IDevice) => _.get(device, ['state', 'toggle', '2', 'toggleState'], 'off') === 'on'
// 	],
// 	[
// 		'switch_2',
// 		(device: IDevice) => _.get(device, ['state', 'toggle', '3', 'toggleState'], 'off') === 'on'
// 	],
// 	[
// 		'switch_3',
// 		(device: IDevice) => _.get(device, ['state', 'toggle', '4', 'toggleState'], 'off') === 'on'
// 	],
// 	[
// 		'battery',
// 		(device: IDevice) => _.get(device, ['state', 'battery', 'battery'], 0)
// 	],
// 	[
// 		'percent',
// 		(device: IDevice) => _.get(device, ['state', 'percentage', 'percentage'], 100)
// 	],
// 	[
// 		'detected',
// 		(device: IDevice) => _.get(device, ['state', 'detect', 'detected'], true)
// 	],
// 	[
// 		'brightness',
// 		(device: IDevice) => _.get(device, ['state', 'brightness', 'brightness'], 100)
// 	],
// 	[
// 		'colorTemperature',
// 		(device: IDevice) => _.get(device, ['state', 'color-temperature', 'colorTemperature'], 50)
// 	],
// 	[
// 		'temperature',
// 		(device: IDevice) => _.get(device, ['state', 'temperature', 'temperature'], 26.5)
// 	],
// 	[
// 		'humidity',
// 		(device: IDevice) => _.get(device, ['state', 'humidity', 'humidity'], 50)
// 	]
// ]);
// // 初始化设备状态
// function getDeviceState(state: IDeviceState, device: IDevice) {
// 	const res: IDeviceState = {};
// 	const props = Object.keys(state) as (keyof IDeviceState)[];
// 	props.forEach((prop) => {
// 		res[prop] = DeviceStateMap.get(prop)!(device);
// 	});
// 	return res;
// }

/**
 * 获取设备更新指令
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
		parser: (params: any) => any,
		getDeviceSend?: (params: any) => any
	}>([
		[ECapability.POWER, {
			getter: (params) => {
				const { device } = params as { device: IDevice };
				return _.get(device, ['state', 'power', 'powerState'], 'off') === 'on'
			},
			parser: (params) => {
				return _.get(params, ['state', 'power', 'powerState'], 'off') === 'on'
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
			parser: (params) => {
				const { state: { toggle = {} } } = params;
				const index = Object.keys(toggle).length ? Object.keys(toggle)[0] : 0
				if (index) {
					return _.get(toggle, [`${+index + 1}`, 'toggleState'], 'off')
				}
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
			parser: (params) => {
				return _.get(params, ['state', 'brightness', 'brightness'], 1)
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
				return _.get(device, ['state', 'color-temperature', 'colorTemperature'], 50)
			},
			parser: (params) => {
				return _.get(params, ['state', 'color-temperature', 'colorTemperature'], 50)
			},
			getDeviceSend: (params) => {
				const { value = 1 } = params;
				return {
					"color-temperature": {
						"colorTemperature": value
					}
				}
			},
		}],
		[ECapability.COLOR_RGB, {
			getter: (params) => {
				const { device } = params as { device: IDevice }
				const { red, green, blue } = _.get(device, ['state', 'color-rgb'], { red: 255, green: 0, blue: 0 })
				return colotConvertUtils.rgb2hsv([red, green, blue])
			},
			parser: (params) => {
				return _.get(params, ['state', 'color-rgb'])
			},
			getDeviceSend: (params) => {
				const { h, s, v } = params;
				const [r, g, b] = colotConvertUtils.hsv2rgb([h, s, v])
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
				return _.get(device, ['state', 'percentage', 'percentage'], 1)
			},
			parser: (params) => {
				return _.get(params, ['state', 'percentage', 'percentage'], 1)
			},
			getDeviceSend(params) {
				const { value = 1 } = params
				return {
					"percentage": {
						"percentage": value
					}
				}
			},
		}],
		[ECapability.BATTERY, {
			getter: (params) => {
				const { device } = params as { device: IDevice }
				return _.get(device, ['state', 'battery', 'battery'], 1)
			},
			parser(params) {
				return _.get(params, ['state', 'battery', 'battery'], 1)
			},
		}],
		[ECapability.DETECT, {
			getter: (params) => {
				const { device } = params as { device: IDevice }
				return _.get(device, ['state', 'detect', 'detected'], false)
			},
			parser(params) {
				return _.get(params, ['state', 'detect', 'detected'], false)
			},
		}],
		[ECapability.HUMIDITY, {
			getter: (params) => {
				const { device } = params as { device: IDevice }
				return _.get(device, ['state', 'humidity', 'humidity'], 20)
			},
			parser(params) {
				return _.get(params, ['state', 'humidity', 'humidity'], 20)
			},
		}],
		[ECapability.TEMPERATURE, {
			getter: (params) => {
				const { device } = params as { device: IDevice }
				return _.get(device, ['state', 'temperature', 'temperature'], 20)
			},
			parser(params) {
				return _.get(params, ['state', 'temperature', 'temperature'], 20)
			},
		}],
		[ECapability.PRESS, {
			getter: (params) => {
				const { device } = params as { device: IDevice }
				const pressKey = _.get(device, ['state', 'press', 'press'], 'singlePress')
				return pressKey === 'singlePress' ? 0 : pressKey === 'doublePress' ? 1 : 2
			},
			parser(params) {
				return _.get(params, ['state', 'temperature', 'temperature'], 20)
			},
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
export function setDeviceName(device: IDevice) {
	!device.name && (device.name = device.manufacturer + ' ' + device.display_category)
}
export default { getMultiDeviceChannel, renderServiceByCapability, getDeviceStateByCap, getDeviceSendState, setDeviceName };

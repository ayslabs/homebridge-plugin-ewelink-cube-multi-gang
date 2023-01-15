import { ECapability } from '../ts/enum/ECapability';
import { IDevice } from '../ts/interface/IDevice';
import _ from 'lodash';
import colotConvertUtils from './colotConvertUtils';

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
				return colotConvertUtils.rgb2hsv([red, green, blue])
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
				return humidity.toFixed(1)
			},
		}],
		[ECapability.TEMPERATURE, {
			getter: (params) => {
				const { device } = params as { device: IDevice }
				const temperature = _.get(device, ['state', 'temperature', 'temperature'], '--')
				return temperature.toFixed(1)
			},
		}],
		[ECapability.PRESS, {
			getter: (params) => {
				const { device } = params as { device: IDevice }
				const pressKey = _.get(device, ['state', 'press', 'press'], 'singlePress')
				return pressKey === 'singlePress' ? 0 : pressKey === 'doublePress' ? 1 : 2
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

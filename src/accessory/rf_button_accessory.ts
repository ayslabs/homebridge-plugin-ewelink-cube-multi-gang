import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';
import { get, isNumber, isString } from 'lodash';
import tools from '../utils/tools';
import IRFBridgeInfo from '../ts/interface/IRFBridgeInfo';


export class rf_button_accessory extends base_accessory {

    switchService: Service | undefined;
    switchService_0: Service | undefined;
    switchService_1: Service | undefined;
    switchService_2: Service | undefined;
    switchService_3: Service | undefined;
    triggerTime: string;
    buttonToSwitchMapping: Record<number, string>;

    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice) {
        super(platform, accessory, Categories.SWITCH, device);
        this.triggerTime = "";
        this.buttonToSwitchMapping = {
            0: "",
            1: "",
            2: "",
            3: "",
        }
    }
    mountService(): void {
        if (!this.accessory) return;

        const rfGatewayConfig = get(this.device, ['tags', '_smartHomeConfig', 'rfGatewayConfig'], null) as IRFBridgeInfo | null;
        if (!rfGatewayConfig) return;

        const isPressCapability = deviceUtils.renderServiceByCapability(this.device, ECapability.PRESS);
        if (!isPressCapability) return;


        const { buttonInfoList } = rfGatewayConfig;


        for (const [idx, buttonInfo] of buttonInfoList.entries()) {
            let service = `switchService_${idx}` as 'switchService_0' | 'switchService_1' | 'switchService_2' | 'switchService_3';
            let switchState = `switch_${idx}` as 'switch_0' | 'switch_1' | 'switch_2' | 'switch_3';
            let subService: string = `switch_${idx}`;



            const isFirstChannel = idx === 0;
            // const serviceType = isFirstChannel ? this.platform.Service.Switch : subService;
            // const curService = this.accessory.getService(serviceType);
            const channelName = buttonInfo.name;

            if (isFirstChannel) {
                this[service] = this.accessory?.getService(this.platform.Service.Switch) || this.accessory?.addService(this.platform.Service.Switch, channelName);
            } else {
                this[service] = this.accessory?.getService(subService) || this.accessory?.addService(this.platform.Service.Switch, channelName, subService);
            }

            this[service]?.updateCharacteristic(this.platform.Characteristic.Name, channelName);

            // use it in updateValue
            this.buttonToSwitchMapping[idx] = buttonInfo.rfChl;

            this[service]?.getCharacteristic(this.platform.Characteristic.On)
                .onGet(() => {
                    return 0;
                }).onSet(async (value: CharacteristicValue) => {
                    // don't handle turn off
                    if (!value) return;
                    const index = switchState.split('_')[1]
                    const params = deviceUtils.getDeviceSendState(ECapability.PRESS, { index: `${buttonInfo.rfChl}` })
                    this.triggerTime = `${Date.now()}`;
                    await this.sendToDevice(params);
                    await tools.sleep(500);
                    this[service]?.getCharacteristic(this.platform.Characteristic.On).updateValue(false);
                    this.triggerTime = "";
                })
        }
    }
    async updateValue() {
        const stateArr = Object.keys(this.device.state);
        const buttonChl = Object.values(this.buttonToSwitchMapping);
        if (!stateArr.length) return;
        for (const stateKey of stateArr) {
            if (stateKey !== ECapability.PRESS) continue;

            const pressChannel = get(this.device.state, ['press', 'press']);
            const updateAt = get(this.device.state, ['press', 'update_at']);

            if (!isString(pressChannel)) continue;
            const switchServiceIdx = buttonChl.indexOf(pressChannel)
            
            let service = `switchService_${switchServiceIdx}` as 'switchService_0' | 'switchService_1' | 'switchService_2' | 'switchService_3';

            if (this[service]?.getCharacteristic(this.platform.Characteristic.On).value) {
                this[service]?.getCharacteristic(this.platform.Characteristic.On).updateValue(false);
            }

            if (this.triggerTime && updateAt && updateAt - +this.triggerTime <= 1000) {
                return;
            }

            this[service]?.getCharacteristic(this.platform.Characteristic.On).updateValue(true);
            await tools.sleep(500);
            this[service]?.getCharacteristic(this.platform.Characteristic.On).updateValue(false);
        }
    }
}

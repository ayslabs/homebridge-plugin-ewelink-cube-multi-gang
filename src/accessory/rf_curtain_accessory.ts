import { base_accessory } from './base_accessory';
import { HomebridgePlatform } from '../HomebridgePlatform';
import { PlatformAccessory, Categories, CharacteristicValue, Service } from 'homebridge';
import { IDevice } from '../ts/interface/IDevice';
import { ECapability } from '../ts/enum/ECapability';
import deviceUtils from '../utils/deviceUtils';
import { get, isNumber, isString } from 'lodash';
import tools from '../utils/tools';
import IRFBridgeInfo from '../ts/interface/IRFBridgeInfo';



export class rf_curtain_accessory extends base_accessory {

    service: Service | undefined;
    triggerTime: string;
    rfChl: string;

    constructor(platform: HomebridgePlatform, accessory: PlatformAccessory | undefined, device: IDevice, rfChl: string) {
        super(platform, accessory, Categories.SWITCH, device, { rfCurtainChl: rfChl });
        this.triggerTime = "";
        this.rfChl = rfChl;
    }
    mountService(): void {
        if (!this.accessory) return;

        const rfGatewayConfig = get(this.device, ['tags', '_smartHomeConfig', 'rfGatewayConfig'], null) as IRFBridgeInfo | null;
        if (!rfGatewayConfig) return;

        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
        this.service?.getCharacteristic(this.platform.Characteristic.On)
            .onGet(() => {
                return 0;
            })
            .onSet(async (value: CharacteristicValue) => {
                if (!value) return;
                const params = deviceUtils.getDeviceSendState(ECapability.PRESS, { index: this.rfChl })
                this.triggerTime = `${Date.now()}`;
                await this.sendToDevice(params);
                await tools.sleep(500);

                if (this.service?.getCharacteristic(this.platform.Characteristic.On).value === false) {
                    this.service?.getCharacteristic(this.platform.Characteristic.On).updateValue(true);
                }
                this.service?.getCharacteristic(this.platform.Characteristic.On).updateValue(false);
                this.triggerTime = "";
            })

    }
    async updateValue() {
        const stateArr = Object.keys(this.device.state);
        if (!stateArr.length) return;
        for (const stateKey of stateArr) {
            if (stateKey !== ECapability.PRESS) continue;

            const pressChannel = get(this.device.state, ['press', 'press']);
            const updateAt = get(this.device.state, ['press', 'update_at']);

            if (!isString(pressChannel) || pressChannel !== this.rfChl) continue;

            if (this.service?.getCharacteristic(this.platform.Characteristic.On).value) {
                this.service?.getCharacteristic(this.platform.Characteristic.On).updateValue(false);
            }

            if (this.triggerTime && updateAt && updateAt - +this.triggerTime <= 1000) {
                return;
            }

            this.service?.getCharacteristic(this.platform.Characteristic.On).updateValue(true);
            await tools.sleep(500);
            this.service?.getCharacteristic(this.platform.Characteristic.On).updateValue(false);
        }
    }
}

export default interface IRFBridgeInfo {
    /** rf button info */
    buttonInfoList: IButtonInfoList[],
    /** current rf button name */
    deviceName: string;
    /** 
    * current rf button type
    * 1 - 1 channel button
    * 2 - 2 channel button
    * 3 - 3 channel button
    * 4 - 4 channel button
    * 5 - curtain
    * 6 - alarm
    */
    type: "1" | "2" | "3" | "4" | "5" | "6";
}


export interface IButtonInfoList {
    /** button channel number */
    rfChl: string;
    /** button channel name */
    name: string;
    /** button channel key */
    rfVal: string
}
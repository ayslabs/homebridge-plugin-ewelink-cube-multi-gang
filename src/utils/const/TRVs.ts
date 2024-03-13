export const GET_TARGET_HEATING_COOLING_STATE_INDEX = 0;
export const GET_CURRENT_HEATING_COOLING_STATE_INDEX = 1;

export const ADAPTIVE_RECOVERY_STATUS_TO_CURRENT_HEATING_STATE_MAPPING = {
    HEATING: 1,
    INACTIVE: 0,
}

export enum MODE_TYPE_OF_HB {
    OFF = 0,
    HEAT = 1,
    AUTO = 3,
}

export enum MODE_OF_TRV {
    ECO = 'ECO',
    MANUAL = 'MANUAL',
    AUTO = 'AUTO',
}

export const MODE_TO_TARGET_HEADING_COOLING_STATE_MAPPING = [
    {
        type: MODE_OF_TRV.ECO,
        name: 'eco-mode',
        code: MODE_TYPE_OF_HB.OFF
    },
    {
        type: MODE_OF_TRV.MANUAL,
        name: 'manual-mode',
        code: MODE_TYPE_OF_HB.HEAT
    },
    {
        type: MODE_OF_TRV.AUTO,
        name: 'auto-mode',
        code: MODE_TYPE_OF_HB.AUTO
    },
]
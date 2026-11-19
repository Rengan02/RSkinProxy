export type ProfileData = {
    name: string;
    id: string;
}

export type PlayerData = {
    uniqueId: string;
    skinIdentifier: SkinIdentifier;
    offlineModeWarningDismissed: boolean;
    history: HistoryItem[];
    dataVersion: number;
}

export type SkinIdentifier = {
    identifier: string;
    type: string;
    skinVariant?: string;
}

type HistoryItem = {
    timestamp: number;
    skinIdentifier: SkinIdentifier;
}

export type PlayerSkin = {
    value: string;
    signature: number;
    dataVersion: number;
}

export type DecodedSkinValue = {
    timestamp: number;
    profileId: string;
    profileName: string;
    signatureRequired: boolean;
    textures: {
        SKIN: {
            url: string;
        }
    }
}

export type PlayerProperty = {
    name: string;
    value: string;
    signature?: string;
};

export type MinecraftProfile = {
    id: string;
    name: string;
    legacy?: boolean;
    properties: PlayerProperty[];
    profileActions?: unknown[];
};
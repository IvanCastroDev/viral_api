export interface msisdnProfile {
    [key: string]: any
    information: Information
    status: Status
    primaryOffering: PrimaryOffering
    freeUnits: FreeUnit[]
  }
  
  export interface Information {
    idSubscriber: string
    IMSI: string
    ICCID: string
    IMEI: string
    coordinates: string
  }
  
  export interface Status {
    subStatus: string
  }
  
  export interface PrimaryOffering {
    offeringId: string
    excessiveProductSpeed: string
  }
  
  export interface FreeUnit {
    name: string
    freeUnit: FreeUnit2
    detailOfferings: DetailOffering[]
  }
  
  export interface FreeUnit2 {
    totalAmt: string
    unusedAmt: string
  }
  
  export interface DetailOffering {
    offeringId: string
    purchaseSecuence: string
    initialAmt: string
    unusedAmt: string
    effectiveDate: string
    expireDate: string
  }
  
export interface ManualTicketRfid{
    id: string;
    batchNumber: string;
    manufactureDatetime: Date;
}

export interface BarCode extends ManualTicketRfid{
    partNumber: string;
}
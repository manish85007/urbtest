import { describe, expect, it } from 'vitest';
import { requestStatusLabel, workQueueForStage } from './stage.js';

describe('work queues', () => {
  it('puts every open stage in a queue, including pre-invoice work', () => {
    expect(workQueueForStage({ stage: 1 })?.key).toBe('awaitingAck');
    expect(workQueueForStage({ stage: 1, returned: true })?.key).toBe('withRequestor');
    expect(workQueueForStage({ stage: 3 })?.key).toBe('assignVehicle');
    expect(workQueueForStage({ stage: 4 })?.key).toBe('weighment');
    expect(workQueueForStage({ stage: 4, allVehiclesWeighed: true, loadingCompleted: false })?.statusLabel).toBe(
      'Complete loading',
    );
    expect(workQueueForStage({ stage: 5, blockingInvoiceStage: null })?.key).toBe('raiseInvoice');
    expect(workQueueForStage({ stage: 5, blockingInvoiceStage: 5 })?.key).toBe('awaitingMrn');
    expect(workQueueForStage({ stage: 6, blockingInvoiceStage: 6 })?.key).toBe('awaitingRecycling');
    expect(workQueueForStage({ stage: 7, blockingInvoiceStage: 7, codUploaded: false })?.statusLabel).toBe(
      'Upload CoD',
    );
    expect(workQueueForStage({ stage: 7, blockingInvoiceStage: 7, codUploaded: true })?.statusLabel).toBe(
      'Certify & publish CoD',
    );
    expect(workQueueForStage({ stage: 8, blockingInvoiceStage: 8 })?.key).toBe('awaitingClose');
    expect(workQueueForStage({ stage: 9 })).toBeNull();
  });

  it('does not call an uninvoiced request awaiting MRN', () => {
    expect(requestStatusLabel(5, { invoiceCount: 0 })).toBe('Ready to invoice');
    expect(requestStatusLabel(5, { invoiceCount: 1 })).toBe('Awaiting MRN');
    expect(requestStatusLabel(8, { invoiceCount: 1 })).toBe('Awaiting client close');
  });
});

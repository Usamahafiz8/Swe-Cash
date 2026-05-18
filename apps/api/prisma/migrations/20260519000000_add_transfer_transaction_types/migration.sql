-- Add transfer transaction types to support user-to-user balance transfers
ALTER TYPE "TransactionType" ADD VALUE 'transfer_out';
ALTER TYPE "TransactionType" ADD VALUE 'transfer_in';

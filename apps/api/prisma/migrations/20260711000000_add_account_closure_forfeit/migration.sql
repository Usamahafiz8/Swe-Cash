-- Residual balance written off when a user deletes their account
ALTER TYPE "TransactionType" ADD VALUE 'account_closure_forfeit';

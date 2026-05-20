-- Track ad screen opens (impressions) separately from ad reward claims
ALTER TYPE "TransactionType" ADD VALUE 'ad_impression';

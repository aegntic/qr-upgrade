import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatBillingAmount} from '../src/lib/billing-format';
test('checkout prices use the currency charge unit, including zero-decimal and legacy cases',()=>{
 assert.equal(formatBillingAmount(1200,'USD','en-US'),'$12.00');
 assert.equal(formatBillingAmount(1200,'JPY','en-US'),'¥1,200');
 assert.equal(formatBillingAmount(500,'ISK','en-US'),'ISK 5');
 assert.equal(formatBillingAmount(500,'UGX','en-US'),'UGX 5');
});

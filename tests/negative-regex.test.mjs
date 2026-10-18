import assert from "node:assert";
import { passesPreFilter } from "../src/lib/filters/negative-regex.ts";

console.log("==================================================");
console.log("🧪 Running Unit Tests: Reverse Negative Regex Filter");
console.log("==================================================");

let passedTests = 0;
let totalTests = 0;

function runTest(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${description}`);
    console.error(`   Error: ${err.message}`);
  }
}

// 1. Arabic Seller Posts (Must FAIL)
runTest("Reject Arabic seller offering services", () => {
  const post = "السلام عليكم، أقدم خدمات تصميم المواقع وتطبيقات الجوال بأسعار مناسبة ومعرض أعمالي متاح بالبايو.";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, "seller_promotion_detected");
});

runTest("Reject Arabic freelancer available for work", () => {
  const post = "مطور واجهات ومواقع متاح للعمل الحر حالياً لتنفيذ أي مشروع برمجيات، تواصل خاص للتنفيذ.";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, "seller_promotion_detected");
});

runTest("Reject Arabic discount/agency promo", () => {
  const post = "تتقدم شركة سمارت بحملة خصم بمناسبة نهاية العام على خدمات السيو وإدارة السوشيال ميديا.";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, "seller_promotion_detected");
});

// 2. English Seller Posts (Must FAIL)
runTest("Reject [For Hire] English post", () => {
  const post = "[For Hire] Full Stack Developer with 5+ years of experience in React and Node.js. DM me for rates.";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, "seller_promotion_detected");
});

runTest("Reject English portfolio sharing seller", () => {
  const post = "Check out my portfolio if you need any graphic design or branding work done this month!";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, "seller_promotion_detected");
});

runTest("Reject English agency promo", () => {
  const post = "We are a leading agency specializing in Shopify store development and conversion rate optimization.";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, "seller_promotion_detected");
});

// 3. Hashtag stuffing spam (Must FAIL)
runTest("Reject post with more than 3 hashtags", () => {
  const post = "Looking to collaborate on exciting projects. #developer #freelance #react #coding #tech";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, "too_many_hashtags");
});

// 4. Invalid length (Must FAIL)
runTest("Reject too short post (<25 characters)", () => {
  const post = "Need web dev";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, "invalid_length");
});

// 5. Genuine High-Intent Arabic Buyer Posts (Must PASS)
runTest("Pass genuine Egyptian buyer post", () => {
  const post = "يا شباب محتاج مبرمج بايثون شاطر يعملي سكريبت سحب داتا ويربطه ببوت تليجرام، الميزانية جاهزة والتنفيذ فوري.";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, true);
});

runTest("Pass genuine Saudi buyer post", () => {
  const post = "السلام عليكم، مطلوب مصمم واجهات UI/UX خبير لتطبيق توصيل في الرياض، نبي نخلص التصاميم خلال أسبوعين.";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, true);
});

runTest("Pass company looking to hire consultant", () => {
  const post = "حد يرشحلي شركة أو مسوق ديجيتال شاطر لإدارة حملات إعلانية على فيسبوك وتيك توك لمتجر ملابس؟";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, true);
});

// 6. Genuine High-Intent English Buyer Posts (Must PASS)
runTest("Pass [Hiring] English buyer post", () => {
  const post = "[Hiring] Looking for a Next.js and Supabase developer to build our SaaS MVP. Budget is $3,500. Please comment or DM with your work.";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, true);
});

runTest("Pass startup founder looking for agency recommendation", () => {
  const post = "Can anyone recommend a trustworthy SEO agency or freelance consultant to help audit our B2B SaaS website?";
  const result = passesPreFilter(post);
  assert.strictEqual(result.passed, true);
});

console.log("==================================================");
console.log(`Summary: ${passedTests}/${totalTests} unit tests passed.`);
if (passedTests === totalTests) {
  console.log("🎉 ALL NEGATIVE REGEX FILTER TESTS PASSED (100%)!");
} else {
  console.error("❌ Some tests failed!");
  process.exit(1);
}
console.log("==================================================");

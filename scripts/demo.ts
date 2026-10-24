import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import { hashPassword, randomToken } from "../lib/security";
import { createPost } from "../lib/content-service";
import { createComment, flagPost, setReaction } from "../lib/feedback-service";
import { advanceProposals, createProposal, castVote, endorseProposal } from "../lib/governance";

async function main() {

const db = getDb();
const marker = db
  .prepare("SELECT id FROM users WHERE email = 'demo1@morrow.local'")
  .get() as { id: string } | undefined;
if (marker) {
  console.log("Demo data already exists. Nothing changed.");
  process.exit(0);
}

const owner = db
  .prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1")
  .get() as { id: string } | undefined;
if (!owner) {
  console.error("Run npm run db:setup first.");
  process.exit(1);
}

const names = [
  ["小禾", "🌾"],
  ["南风", "🍃"],
  ["林间", "🌿"],
  ["阿澄", "🍊"],
  ["一舟", "🕊️"],
  ["小满", "🌻"],
  ["青岚", "🌙"],
  ["暖川", "☀️"],
  ["拾光", "🐚"],
  ["山野", "🌱"],
  ["小鹿", "🦌"]
];
const demoPassword = process.env.MORROW_DEMO_PASSWORD ?? randomToken(10);
const password = hashPassword(demoPassword);
const userIds: string[] = [];
for (let index = 0; index < names.length; index += 1) {
  const [name, emoji] = names[index];
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users
      (id, email, password_hash, password_salt, display_name, avatar_emoji,
       role, email_verified, accepted_covenant, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, 'member', 1, 1, ?, ?)`
  ).run(
    id,
    `demo${index + 1}@morrow.local`,
    password.hash,
    password.salt,
    name,
    emoji,
    new Date(Date.now() - index * 86_400_000).toISOString(),
    new Date().toISOString()
  );
  userIds.push(id);
}

const posts: Array<{ id: string; author: string; body: string }> = [];
const content = [
  "今天下班时看到窗边的光落在桌上的绿萝上，忽然觉得这一整天都被轻轻接住了。",
  "和很久没见的朋友通了电话。我们都没有解决什么大问题，但挂断时心里轻了一点。",
  "给妈妈做了一顿饭，她说味道像小时候。原来被记住的不只是菜。",
  "今天第一次在清晨散步，听到了三种鸟叫。城市在那个时候很温柔。",
  "把拖了很久的小事做完了。没有掌声，但我给自己倒了一杯热水。",
  "电梯里有个小朋友冲我笑了一下，那一层楼好像都亮了一点。",
  "今天把手机放在一边，认真读完了一本书的一章。安静也是一种礼物。",
  "下雨了，路过的人把伞往我这边偏了一点。我们甚至没有交换名字。",
  "在阳台上种的薄荷冒出了新叶。原来生活真的会回应一点点照顾。",
  "今天没有特别好的事，但我认真吃了饭，也认真睡了午觉。这也算美好。",
  "整理旧照片时发现，很多当时不以为意的日子，现在看都在发光。",
  "晚饭后和爱人一起洗碗，水声、碗碟声和聊天声混在一起，很普通，也很踏实。"
];

for (let index = 0; index < content.length; index += 1) {
  const authorId = index === 0 ? owner.id : userIds[index % userIds.length];
  const result = await createPost({
    userId: authorId,
    body: content[index],
    promptDay: index === 0 ? 1 : null,
    files: [],
    originalityConfirmed: true
  });
  if (result.ok) posts.push({ id: result.postId, author: authorId, body: content[index] });
}

if (posts.length > 0) {
  const featured = posts[0];
  for (const userId of [...userIds.slice(0, 5), owner.id]) {
    if (userId !== featured.author) setReaction(userId, featured.id, "love");
  }
  for (const userId of userIds.slice(5, 8)) {
    setReaction(userId, featured.id, "smile");
  }
  setReaction(userIds[0], featured.id, "calm");

  const comments = [
    "这束光真好看，像是今天给你的回信。",
    "被这句话轻轻安慰到了。",
    "也想起今天经过的一小片树影。"
  ];
  for (let index = 0; index < comments.length; index += 1) {
    createComment(userIds[index], featured.id, comments[index]);
  }

  const controversial = posts[1];
  for (let index = 0; index < 10; index += 1) {
    setReaction(userIds[index], controversial.id, index < 8 ? "smile" : "cry");
  }
  flagPost(userIds[9], controversial.id, ["fake"]);
}

const proposalOne = createProposal({
  userId: owner.id,
  kind: "normal",
  title: "把内容隐藏的最少反馈人数调整为 12 人",
  body:
    "随着新成员加入，10 人的门槛可能过早触发。建议把最少反馈人数调整为 12 人，让样本更稳定。这个提案只修改该参数，其余社区底线保持不变。",
  settingKey: "min_feedback_participants",
  settingValue: "12"
});

const proposalTwo = createProposal({
  userId: userIds[0],
  kind: "normal",
  title: "增加一个“今日没有特别的事”的温柔选项",
  body:
    "有些日子没有特别的故事，但仍然值得被记录。建议让每日问题保留一个“今天很普通，也被我认真过完”的回应提示，不改变广场结构。",
  settingKey: null,
  settingValue: null
});
if (proposalTwo.ok) {
  endorseProposal(userIds[1], proposalTwo.id!);
  endorseProposal(userIds[2], proposalTwo.id!);
}

advanceProposals();

if (proposalTwo.ok) {
  const votingProposalId = proposalTwo.id!;
  db.prepare(
    "UPDATE proposals SET status = 'voting', discussion_ends_at = ?, vote_ends_at = ? WHERE id = ?"
  ).run(
    new Date(Date.now() - 86_400_000).toISOString(),
    new Date(Date.now() + 86_400_000).toISOString(),
    votingProposalId
  );
  for (let index = 0; index < 7; index += 1) {
    castVote(userIds[index], votingProposalId, index < 6 ? "yes" : "no");
  }
}

console.log("Demo data created.");
console.log(`Demo member password: ${demoPassword}`);
console.log("Demo accounts: demo1@morrow.local through demo11@morrow.local");
console.log(`Proposal draft: ${proposalOne.ok ? proposalOne.id : "skipped"}`);
console.log(`Proposal voting: ${proposalTwo.ok ? proposalTwo.id : "skipped"}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

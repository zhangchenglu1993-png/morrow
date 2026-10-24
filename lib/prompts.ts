export type DailyPrompt = {
  day: number;
  theme: string;
  question: string;
};

export const DAILY_PROMPTS: DailyPrompt[] = [
  { day: 1, theme: "觉察", question: "今天哪一个微小瞬间，让你觉得“活着真好”？" },
  { day: 2, theme: "觉察", question: "今天有什么事情，比预想中更顺利？" },
  { day: 3, theme: "关系", question: "今天谁的一个举动，让你感到温暖？" },
  { day: 4, theme: "自我关怀", question: "今天你为自己做了什么？" },
  { day: 5, theme: "感官", question: "今天哪一种声音、气味或触感让你愉悦？" },
  { day: 6, theme: "感恩", question: "今天有什么看似普通的事，值得感谢？" },
  { day: 7, theme: "回顾", question: "回看这一周，你最想留住哪一刻？" },
  { day: 8, theme: "投入", question: "今天你在哪件事里忘记了时间？" },
  { day: 9, theme: "优势", question: "今天你用了自己的哪一个长处？" },
  { day: 10, theme: "成长", question: "今天你完成了哪一个原本觉得困难的小挑战？" },
  { day: 11, theme: "学习", question: "今天你学到了什么新东西？" },
  { day: 12, theme: "好奇", question: "今天什么让你产生了好奇？" },
  { day: 13, theme: "投入", question: "今天你把心力投入到了哪里？" },
  { day: 14, theme: "回顾", question: "这一周，你对自己有了什么新发现？" },
  { day: 15, theme: "连接", question: "今天你和谁有了一次真实的连接？" },
  { day: 16, theme: "善意", question: "今天你为别人做的一件小事是什么？" },
  { day: 17, theme: "被理解", question: "今天谁让你感到被理解？" },
  { day: 18, theme: "感恩", question: "今天你想对谁表达感谢？" },
  { day: 19, theme: "宽恕", question: "今天你原谅了别人或自己的哪一点？" },
  { day: 20, theme: "表达", question: "今天你想对一位朋友说什么？" },
  { day: 21, theme: "关系", question: "这一周，哪段关系让你感到被滋养？" },
  { day: 22, theme: "平静", question: "今天什么让你感到平静？" },
  { day: 23, theme: "身体", question: "今天身体给了你什么提醒？" },
  { day: 24, theme: "行动", question: "今天你迈出了哪一小步？" },
  { day: 25, theme: "希望", question: "今天什么给了你希望？" },
  { day: 26, theme: "自我关怀", question: "今天你如何照顾自己？" },
  { day: 27, theme: "自豪", question: "今天哪件小事让你为自己骄傲？" },
  { day: 28, theme: "意义", question: "如果为今天留下一句话，你会写什么？" },
  { day: 29, theme: "回望", question: "这个月里，什么正在悄悄变好？" },
  { day: 30, theme: "传承", question: "你想把哪一份美好，留给未来的自己？" }
];

export function promptForDay(day: number): DailyPrompt {
  return DAILY_PROMPTS[(Math.max(day, 1) - 1) % DAILY_PROMPTS.length];
}

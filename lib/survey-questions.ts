export interface SurveyQuestion {
  id: number
  category: string
  question: string
  type: "scale" | "text"
}

export const surveyQuestions: SurveyQuestion[] = [
  // 変化意識 (10問)
  { id: 1, category: "変化意識", question: "組織の変化に対して前向きに対応していますか？", type: "scale" },
  { id: 2, category: "変化意識", question: "変化の必要性を理解していますか？", type: "scale" },
  { id: 3, category: "変化意識", question: "新しい環境への適応力がありますか？", type: "scale" },
  { id: 4, category: "変化意識", question: "変化をチャンスと捉えていますか？", type: "scale" },
  { id: 5, category: "変化意識", question: "変化に対する不安を乗り越えられていますか？", type: "scale" },
  { id: 6, category: "変化意識", question: "組織の変化方針を理解していますか？", type: "scale" },
  { id: 7, category: "変化意識", question: "変化への取り組みに参加していますか？", type: "scale" },
  { id: 8, category: "変化意識", question: "変化の進捗状況を把握していますか？", type: "scale" },
  { id: 9, category: "変化意識", question: "変化に対する上司のサポートは十分ですか？", type: "scale" },
  { id: 10, category: "変化意識", question: "変化を通じたグロースを感じていますか？", type: "scale" },

  // 成果視点 (10問)
  { id: 11, category: "成果視点", question: "成果を重視する文化がありますか？", type: "scale" },
  { id: 12, category: "成果視点", question: "目標達成に向けて努力していますか？", type: "scale" },
  { id: 13, category: "成果視点", question: "成果の測定方法は明確ですか？", type: "scale" },
  { id: 14, category: "成果視点", question: "成果に対する評価は公平ですか？", type: "scale" },
  { id: 15, category: "成果視点", question: "成果を上げるための環境が整っていますか？", type: "scale" },
  { id: 16, category: "成果視点", question: "成果に対するインセンティブは適切ですか？", type: "scale" },
  { id: 17, category: "成果視点", question: "成果の共有と祝賀が行われていますか？", type: "scale" },
  { id: 18, category: "成果視点", question: "成果を上げるための支援体制がありますか？", type: "scale" },
  { id: 19, category: "成果視点", question: "成果の向上に向けた改善が行われていますか？", type: "scale" },
  { id: 20, category: "成果視点", question: "成果を通じた自己実現を感じていますか？", type: "scale" },

  // 行動優先意識 (10問)
  { id: 21, category: "行動優先意識", question: "行動を重視する文化がありますか？", type: "scale" },
  { id: 22, category: "行動優先意識", question: "迅速な行動が評価されていますか？", type: "scale" },
  { id: 23, category: "行動優先意識", question: "行動に移すための権限は十分ですか？", type: "scale" },
  { id: 24, category: "行動優先意識", question: "行動の結果から学ぶ文化がありますか？", type: "scale" },
  { id: 25, category: "行動優先意識", question: "失敗を恐れずチャレンジできますか？", type: "scale" },
  { id: 26, category: "行動優先意識", question: "行動に必要なリソースは確保されていますか？", type: "scale" },
  { id: 27, category: "行動優先意識", question: "行動の進捗状況は共有されていますか？", type: "scale" },
  { id: 28, category: "行動優先意識", question: "行動を促進する仕組みがありますか？", type: "scale" },
  { id: 29, category: "行動優先意識", question: "行動を通じたグロースを感じていますか？", type: "scale" },
  { id: 30, category: "行動優先意識", question: "行動への上司のサポートは十分ですか？", type: "scale" },

  // 結果明確 (10問)
  { id: 31, category: "結果明確", question: "期待される結果が明確に定義されていますか？", type: "scale" },
  { id: 32, category: "結果明確", question: "結果の基準は理解しやすいですか？", type: "scale" },
  { id: 33, category: "結果明確", question: "結果の測定方法は透明ですか？", type: "scale" },
  { id: 34, category: "結果明確", question: "結果に対するフィードバックは適切ですか？", type: "scale" },
  { id: 35, category: "結果明確", question: "結果の達成状況は可視化されていますか？", type: "scale" },
  { id: 36, category: "結果明確", question: "結果の目標値は現実的ですか？", type: "scale" },
  { id: 37, category: "結果明確", question: "結果の達成に向けた支援がありますか？", type: "scale" },
  { id: 38, category: "結果明確", question: "結果の改善に向けた取り組みが行われていますか？", type: "scale" },
  { id: 39, category: "結果明確", question: "結果の共有は定期的に行われていますか？", type: "scale" },
  { id: 40, category: "結果明確", question: "結果を通じた組織のグロースを感じていますか？", type: "scale" },

  // 自己評価意識 (10問)
  { id: 41, category: "自己評価意識", question: "自分の強みを理解していますか？", type: "scale" },
  { id: 42, category: "自己評価意識", question: "自分の改善点を認識していますか？", type: "scale" },
  { id: 43, category: "自己評価意識", question: "自己評価と上司の評価は一致していますか？", type: "scale" },
  { id: 44, category: "自己評価意識", question: "自分のグロースを実感していますか？", type: "scale" },
  { id: 45, category: "自己評価意識", question: "自分のキャリアパスは明確ですか？", type: "scale" },
  { id: 46, category: "自己評価意識", question: "自分の能力を活かせる環境ですか？", type: "scale" },
  { id: 47, category: "自己評価意識", question: "自分の評価は公平だと感じていますか？", type: "scale" },
  { id: 48, category: "自己評価意識", question: "自分のグロースに向けた支援がありますか？", type: "scale" },
  { id: 49, category: "自己評価意識", question: "自分の価値を組織に認識されていますか？", type: "scale" },
  { id: 50, category: "自己評価意識", question: "自分の将来に対して前向きですか？", type: "scale" },

  // 時感覚 (10問)
  { id: 51, category: "時感覚", question: "時間管理は適切に行われていますか？", type: "scale" },
  { id: 52, category: "時感覚", question: "業務の優先順位は明確ですか？", type: "scale" },
  { id: 53, category: "時感覚", question: "期限の設定は現実的ですか？", type: "scale" },
  { id: 54, category: "時感覚", question: "期限の遵守率は高いですか？", type: "scale" },
  { id: 55, category: "時感覚", question: "時間を有効活用できていますか？", type: "scale" },
  { id: 56, category: "時感覚", question: "業務の進捗状況は把握できていますか？", type: "scale" },
  { id: 57, category: "時感覚", question: "期限に対する意識は高いですか？", type: "scale" },
  { id: 58, category: "時感覚", question: "時間的な余裕を持って業務に取り組めていますか？", type: "scale" },
  { id: 59, category: "時感覚", question: "期限の変更は適切に対応されていますか？", type: "scale" },
  { id: 60, category: "時感覚", question: "時間に対する組織の文化は健全ですか？", type: "scale" },

  // 組織内位置認識 (9問)
  { id: 61, category: "組織内位置認識", question: "自分の役割は明確ですか？", type: "scale" },
  { id: 62, category: "組織内位置認識", question: "自分の責任範囲は理解していますか？", type: "scale" },
  { id: 63, category: "組織内位置認識", question: "組織内での自分の位置づけを理解していますか？", type: "scale" },
  { id: 64, category: "組織内位置認識", question: "自分の部門の役割は明確ですか？", type: "scale" },
  { id: 65, category: "組織内位置認識", question: "他部門との関係性は良好ですか？", type: "scale" },
  { id: 66, category: "組織内位置認識", question: "組織全体の中での自分の貢献を感じていますか？", type: "scale" },
  { id: 67, category: "組織内位置認識", question: "組織の目標と自分の役割の関連性は理解していますか？", type: "scale" },
  { id: 68, category: "組織内位置認識", question: "組織内でのキャリアの可能性を感じていますか？", type: "scale" },
  { id: 69, category: "組織内位置認識", question: "組織への帰属意識は高いですか？", type: "scale" },

  // 免責意識 (9問)
  { id: 70, category: "免責意識", question: "責任を持って業務に取り組んでいますか？", type: "scale" },
  { id: 71, category: "免責意識", question: "自分の行動に対して責任を感じていますか？", type: "scale" },
  { id: 72, category: "免責意識", question: "問題が発生した際に責任を回避していないですか？", type: "scale" },
  { id: 73, category: "免責意識", question: "自分の決定に対して責任を持っていますか？", type: "scale" },
  { id: 74, category: "免責意識", question: "チーム全体の責任を共有していますか？", type: "scale" },
  { id: 75, category: "免責意識", question: "責任感を持つ文化が組織に根付いていますか？", type: "scale" },
  { id: 76, category: "免責意識", question: "失敗から学び改善する姿勢がありますか？", type: "scale" },
  { id: 77, category: "免責意識", question: "責任を果たすための支援体制がありますか？", type: "scale" },
  { id: 78, category: "免責意識", question: "責任を通じたグロースを感じていますか？", type: "scale" },
]

export const categories = [
  "変化意識",
  "成果視点",
  "行動優先意識",
  "結果明確",
  "自己評価意識",
  "時感覚",
  "組織内位置認識",
  "免責意識",
]

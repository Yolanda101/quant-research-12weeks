export const exercises = [
  {
    "id": "audit-schema",
    "title": "数据字典和质量报告",
    "description": "检查唯一键、缺失价格和非正价格，写清价格、成交量及市值的单位。",
    "target": "生成 quality_report 和 field_units 两个字典。先报告问题，不用删除记录掩盖问题。",
    "hint": "使用 duplicated、isna 和价格小于等于零的布尔条件。重复键由 observed_at 和 asset 组成。",
    "code": "import pandas as pd\nfrom io import StringIO\n\nquality = pd.read_csv(StringIO('observed_at,asset,raw_close,volume\\r\\n2021-03-31,Q001,99,12000\\r\\n2021-03-31,Q002,70,9000\\r\\n2021-03-31,Q002,70,9000\\r\\n2021-03-31,Q003,,7000\\r\\n2021-04-01,Q001,-1,11000\\r\\n2021-04-01,Q003,50,8000\\r\\n'))\n\n# 重复键只统计第一条之后的额外行。缺失价格不算非正价格。\nquality_report = None\nfield_units = None\nprint(quality_report)\nprint(field_units)\n",
    "expected": [
      {
        "name": "quality_report",
        "value": {
          "rows": 6,
          "duplicate_keys": 1,
          "missing_close": 1,
          "nonpositive_close": 1
        },
        "label": "quality_report"
      },
      {
        "name": "field_units",
        "value": {
          "raw_close": "元每股",
          "volume": "股",
          "market_cap": "元"
        },
        "label": "field_units"
      }
    ]
  },
  {
    "id": "audit-universe",
    "title": "重建历史股票池",
    "description": "按历史存续区间选择股票，并查出当前名单回填造成的遗漏。",
    "target": "输出按资产代码排序的 historical_pool 和 lost_assets 列表。",
    "hint": "条件为 listed_at <= day，且 delisted_at 缺失或严格大于 day。退出资产仍保留在原始文件。",
    "code": "import pandas as pd\nfrom io import StringIO\n\nuniverse = pd.read_csv(StringIO('asset,name,listed_at,delisted_at\\r\\nQ001,青川制造,2015-01-05,2022-06-30\\r\\nQ002,北辰设备,2014-01-06,\\r\\nQ003,云河材料,2019-07-01,\\r\\nQ004,远帆科技,2021-04-15,2023-09-29\\r\\n'))\n\nas_of = \"2021-03-31\"\ncurrent_at = \"2023-12-31\"\n\n# listed_at 起生效，delisted_at 当天起退出。\n# 先重建历史股票池，再检查用当前名单回填会丢掉哪些样本。\nhistorical_pool = None\nlost_assets = None\nprint(historical_pool)\nprint(lost_assets)\n",
    "expected": [
      {
        "name": "historical_pool",
        "value": [
          "Q001",
          "Q002",
          "Q003"
        ],
        "label": "historical_pool"
      },
      {
        "name": "lost_assets",
        "value": [
          "Q001"
        ],
        "label": "lost_assets"
      }
    ]
  },
  {
    "id": "audit-availability",
    "title": "选择当时可用的财报",
    "description": "报告期、发布时间和可用时间分别记录。对同一报告期保留首次版本及修订版本。",
    "target": "输出 selected_reports，每行依次是资产、报告期、版本、值。计算Q001修订差值 revision_delta。",
    "hint": "先过滤 available_at <= signal_at。仅按 period_end 排序会混入后来修订。",
    "code": "import pandas as pd\nfrom io import StringIO\n\nreports = pd.read_csv(StringIO('asset,period_end,published_at,available_at,version,value\\r\\nQ001,2020-12-31,2021-03-30T18:00:00+08:00,2021-03-31T08:30:00+08:00,1,120.0\\r\\nQ001,2020-12-31,2021-04-01T18:00:00+08:00,2021-04-02T08:30:00+08:00,2,135.0\\r\\nQ002,2019-12-31,2020-03-27T18:00:00+08:00,2020-03-30T08:30:00+08:00,1,70.0\\r\\nQ002,2020-12-31,2021-03-31T16:00:00+08:00,2021-03-31T16:30:00+08:00,1,80.0\\r\\n'))\n\nsignal_at = '2021-03-31T15:00:00+08:00'\n\n# 先按 available_at 截断，再按资产选最新报告期和当时最新版本。\n# revision_delta 是事后审计差值，不能作为03-31的信号输入。\nselected_reports = None\nrevision_delta = None\nprint(selected_reports)\nprint(revision_delta)\n",
    "expected": [
      {
        "name": "selected_reports",
        "value": [
          [
            "Q001",
            "2020-12-31",
            1,
            120.0
          ],
          [
            "Q002",
            "2019-12-31",
            1,
            70.0
          ]
        ],
        "label": "selected_reports"
      },
      {
        "name": "revision_delta",
        "value": 15.0,
        "label": "revision_delta"
      }
    ]
  },
  {
    "id": "audit-pricing",
    "title": "定义可交易收益标签",
    "description": "信号形成后在下一观察日开盘买入，随后按指定开盘退出，收益计入持有期分红。",
    "target": "计算 raw_price_return、total_return，按先后顺序保存 label_times。收益用小数。",
    "hint": "开盘成交价100和101，分红2。总收益为卖出价格加分红，除以买入价格后减1。标签到退出时点才可得。",
    "code": "import pandas as pd\nfrom io import StringIO\n\nprices = pd.read_csv(StringIO('asset,observed_at,available_at,raw_open,raw_close,open_available_at,close_available_at,tradable\\r\\nQ001,2021-03-31,2021-03-31T15:00:00+08:00,98,99,2021-03-31T09:30:00+08:00,2021-03-31T15:00:00+08:00,1\\r\\nQ001,2021-04-01,2021-04-01T15:00:00+08:00,100,101,2021-04-01T09:30:00+08:00,2021-04-01T15:00:00+08:00,1\\r\\nQ001,2021-04-15,2021-04-15T15:00:00+08:00,99,99,2021-04-15T09:30:00+08:00,2021-04-15T15:00:00+08:00,1\\r\\nQ001,2021-04-30,2021-04-30T15:00:00+08:00,100,100,2021-04-30T09:30:00+08:00,2021-04-30T15:00:00+08:00,1\\r\\nQ001,2021-05-03,2021-05-03T15:00:00+08:00,101,102,2021-05-03T09:30:00+08:00,2021-05-03T15:00:00+08:00,1\\r\\n'))\ndividends = pd.read_csv(StringIO('asset,ex_at,paid_at,cash_per_share\\r\\nQ001,2021-04-15T09:30:00+08:00,2021-04-20T09:30:00+08:00,2.0\\r\\n'))\n\nsignal_at = '2021-03-31T15:00:00+08:00'\nentry_at = '2021-04-01T09:30:00+08:00'\nexit_at = '2021-05-03T09:30:00+08:00'\n\n# 本题无拆并股，买卖各一股，忽略税费。分红2元在持有期内到账。\n# 原始价格用于成交，现金分红用于含分红收益。整行在收盘后完整可用。\nraw_price_return = None\ntotal_return = None\nlabel_times = None\nprint(raw_price_return, total_return)\nprint(label_times)\n",
    "expected": [
      {
        "name": "raw_price_return",
        "value": 0.01,
        "label": "raw_price_return"
      },
      {
        "name": "total_return",
        "value": 0.03,
        "label": "total_return"
      },
      {
        "name": "label_times",
        "value": [
          "2021-03-31T15:00:00+08:00",
          "2021-04-01T09:30:00+08:00",
          "2021-05-03T09:30:00+08:00"
        ],
        "label": "label_times"
      }
    ]
  },
  {
    "id": "audit-splits",
    "title": "剔除跨界标签",
    "description": "研究区间为2016至2021年，验证区间为2022至2023年，2024至2025年封存。",
    "target": "输出可拟合样本、跨界样本、验证样本和封存日期范围。",
    "hint": "样本C的信号在2021年，标签到2022年才可得。研究期拟合时应剔除C。",
    "code": "import pandas as pd\nfrom io import StringIO\n\nlabels = pd.read_csv(StringIO('sample,signal_at,entry_at,exit_at,label_available_at\\r\\nA,2021-10-29T15:00:00+08:00,2021-11-01T09:30:00+08:00,2021-12-01T09:30:00+08:00,2021-12-01T09:30:00+08:00\\r\\nB,2021-11-30T15:00:00+08:00,2021-12-01T09:30:00+08:00,2021-12-30T09:30:00+08:00,2021-12-30T09:30:00+08:00\\r\\nC,2021-12-31T15:00:00+08:00,2022-01-04T09:30:00+08:00,2022-02-01T09:30:00+08:00,2022-02-01T09:30:00+08:00\\r\\nD,2022-01-31T15:00:00+08:00,2022-02-01T09:30:00+08:00,2022-03-01T09:30:00+08:00,2022-03-01T09:30:00+08:00\\r\\n'))\n\nresearch_start = \"2016-01-01T00:00:00+08:00\"\nresearch_end = \"2021-12-31T23:59:59+08:00\"\nvalidation_start = \"2022-01-01T00:00:00+08:00\"\nvalidation_end = \"2023-12-31T23:59:59+08:00\"\n\n# 训练拟合时，标签必须已经可得。不能只看信号所属年份。\nfit_samples = None\ncrossing_samples = None\nvalidation_samples = None\nsealed_range = None\nprint(fit_samples, crossing_samples, validation_samples, sealed_range)\n",
    "expected": [
      {
        "name": "fit_samples",
        "value": [
          "A",
          "B"
        ],
        "label": "fit_samples"
      },
      {
        "name": "crossing_samples",
        "value": [
          "C"
        ],
        "label": "crossing_samples"
      },
      {
        "name": "validation_samples",
        "value": [
          "D"
        ],
        "label": "validation_samples"
      },
      {
        "name": "sealed_range",
        "value": [
          "2024-01-01",
          "2025-12-31"
        ],
        "label": "sealed_range"
      }
    ]
  },
  {
    "id": "audit-manifest",
    "title": "核对文本和分钟样本版本",
    "description": "检查公告延迟、编码器训练截止和分钟记录完成时间，为后续文本及执行实验准备清单。",
    "target": "输出当时可见文档、合格编码器、可见分钟结束时点和含未来信息的编码器名称。",
    "hint": "缺少训练截止记录的编码器暂不进入历史对照。按 available_at 过滤文本和分钟数据。",
    "code": "import pandas as pd\nfrom io import StringIO\n\ntexts = pd.read_csv(StringIO('document_id,asset,published_at,available_at,version,text\\r\\nD001,Q001,2021-03-30T18:00:00+08:00,2021-03-31T08:45:00+08:00,1,本期设备更新，新增产线已投入生产。\\r\\nD002,Q002,2021-03-31T16:00:00+08:00,2021-03-31T16:45:00+08:00,1,公司披露年度营业资料。\\r\\n'))\nencoders = pd.read_csv(StringIO('encoder,version,training_cutoff,released_at\\r\\nlexicon-2020,1.0,2020-12-31,2021-01-15T09:00:00+08:00\\r\\nfuture-encoder-2022,2.0,2022-12-31,2023-01-15T09:00:00+08:00\\r\\nundocumented-encoder,0.1,,2021-01-20T09:00:00+08:00\\r\\n'))\nminutes = pd.read_csv(StringIO('asset,bar_start,bar_end,available_at,price,volume\\r\\nQ001,2021-04-01T09:30:00+08:00,2021-04-01T09:31:00+08:00,2021-04-01T09:31:00+08:00,100.0,2000\\r\\nQ001,2021-04-01T09:31:00+08:00,2021-04-01T09:32:00+08:00,2021-04-01T09:32:00+08:00,100.2,1200\\r\\nQ001,2021-04-01T09:32:00+08:00,2021-04-01T09:33:00+08:00,2021-04-01T09:33:00+08:00,100.1,800\\r\\n'))\n\nsignal_at = '2021-03-31T15:00:00+08:00'\nexecution_check_at = \"2021-04-01T09:31:00+08:00\"\n\n# 编码器训练截止必须有记录，训练截止和发布时间均不能晚于评价时点。\n# 09:31只可使用已经完成并可用的分钟记录。\nvisible_documents = None\neligible_encoders = None\nvisible_bars = None\nunsafe_encoder = None\nprint(visible_documents, eligible_encoders, visible_bars, unsafe_encoder)\n",
    "expected": [
      {
        "name": "visible_documents",
        "value": [
          "D001"
        ],
        "label": "visible_documents"
      },
      {
        "name": "eligible_encoders",
        "value": [
          "lexicon-2020"
        ],
        "label": "eligible_encoders"
      },
      {
        "name": "visible_bars",
        "value": [
          "2021-04-01T09:31:00+08:00"
        ],
        "label": "visible_bars"
      },
      {
        "name": "unsafe_encoder",
        "value": "future-encoder-2022",
        "label": "unsafe_encoder"
      }
    ]
  }
];

export const assignment = {
  "intro": "整理一份研究数据包，核对历史股票池、财报版本、收益标签和时间切分。",
  "sections": "<section class=\"panel homework-brief\"><h2>交付一份可追溯的数据审计</h2><p>使用模板中的虚构样本，完成六项输出和三条文字解释。日期按 Asia/Shanghai 记录，配套交易日历规定观察日。2024至2025年仅提供封存边界。</p><ol><li>输出质量报告，说明重复键、缺失和非正价格。</li><li>重建2021年3月31日股票池，保留后来退出的历史样本。</li><li>按可用时间选择当时财报，修订版本保留在原始表。</li><li>定义信号、成交和退出时点，使用原始价格和现金分红计算标签。</li><li>划分研究、验证和封存区间，剔除训练期末仍未知的标签。</li><li>核对公告文本、编码器和分钟记录的可用时点。</li></ol><p>提交前任选五条记录，写出原始文件、原始值、可用时间、信号时间和最早成交时间。代码校验检查给定样本的计算结果，文字和追溯记录由教师阅读。</p></section>",
  "questions": [
    "用2023年末仍存续的股票名单回填2021年，会丢掉哪只股票？说明这会怎样改变样本。",
    "说明Q001和Q002在信号时分别可用哪个财报版本，再说明成交价、现金分红和调整价格各自用于什么计算。",
    "说明样本C为什么不能进入2021年末训练，并写出编码器、分钟数据和封存期的三条检查规则。"
  ],
  "expected": [
    {
      "name": "quality_report",
      "value": {
        "rows": 6,
        "duplicate_keys": 1,
        "missing_close": 1,
        "nonpositive_close": 1
      },
      "label": "quality_report"
    },
    {
      "name": "historical_pool",
      "value": [
        "Q001",
        "Q002",
        "Q003"
      ],
      "label": "historical_pool"
    },
    {
      "name": "selected_reports",
      "value": [
        [
          "Q001",
          "2020-12-31",
          1,
          120.0
        ],
        [
          "Q002",
          "2019-12-31",
          1,
          70.0
        ]
      ],
      "label": "selected_reports"
    },
    {
      "name": "audit_label",
      "value": [
        "2021-03-31T15:00:00+08:00",
        "2021-04-01T09:30:00+08:00",
        "2021-05-03T09:30:00+08:00",
        100.0,
        101.0,
        2.0,
        0.03
      ],
      "label": "audit_label"
    },
    {
      "name": "fit_samples",
      "value": [
        "A",
        "B"
      ],
      "label": "fit_samples"
    },
    {
      "name": "crossing_samples",
      "value": [
        "C"
      ],
      "label": "crossing_samples"
    },
    {
      "name": "version_review",
      "value": [
        [
          "D001"
        ],
        [
          "lexicon-2020"
        ],
        [
          "2021-04-01T09:31:00+08:00"
        ]
      ],
      "label": "version_review"
    }
  ],
  "dataFiles": [
    {
      "file": "week01-research-universe.csv",
      "label": "历史存续区间"
    },
    {
      "file": "week01-research-reports.csv",
      "label": "财报可用版本"
    },
    {
      "file": "week01-research-quality.csv",
      "label": "含缺失和重复的审计样本"
    },
    {
      "file": "week01-research-prices.csv",
      "label": "原始价格及开盘、收盘可用时点"
    },
    {
      "file": "week01-research-dividends.csv",
      "label": "现金分红事件"
    },
    {
      "file": "week01-research-calendar.csv",
      "label": "合成交易日历"
    },
    {
      "file": "week01-research-labels.csv",
      "label": "标签起止和可用时点"
    },
    {
      "file": "week01-research-texts.csv",
      "label": "带可用时间的公告文本"
    },
    {
      "file": "week01-research-encoders.csv",
      "label": "编码器训练截止和发布时间"
    },
    {
      "file": "week01-research-minutes.csv",
      "label": "完成后才可见的分钟记录"
    },
    {
      "file": "week01-research-panel.csv",
      "label": "开发期月度观察，不用于逐日成交重放"
    },
    {
      "file": "week01-research-manifest.csv",
      "label": "数据版本清单"
    }
  ]
};

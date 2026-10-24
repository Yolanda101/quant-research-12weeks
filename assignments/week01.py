# 第一周作业：研究数据和信息时点
# 数据为虚构样本。运行后将None替换为计算结果，填写三条answers。
import pandas as pd
from io import StringIO

quality = pd.read_csv(StringIO('observed_at,asset,raw_close,volume\r\n2021-03-31,Q001,99,12000\r\n2021-03-31,Q002,70,9000\r\n2021-03-31,Q002,70,9000\r\n2021-03-31,Q003,,7000\r\n2021-04-01,Q001,-1,11000\r\n2021-04-01,Q003,50,8000\r\n'))
universe = pd.read_csv(StringIO('asset,name,listed_at,delisted_at\r\nQ001,青川制造,2015-01-05,2022-06-30\r\nQ002,北辰设备,2014-01-06,\r\nQ003,云河材料,2019-07-01,\r\nQ004,远帆科技,2021-04-15,2023-09-29\r\n'))
reports = pd.read_csv(StringIO('asset,period_end,published_at,available_at,version,value\r\nQ001,2020-12-31,2021-03-30T18:00:00+08:00,2021-03-31T08:30:00+08:00,1,120.0\r\nQ001,2020-12-31,2021-04-01T18:00:00+08:00,2021-04-02T08:30:00+08:00,2,135.0\r\nQ002,2019-12-31,2020-03-27T18:00:00+08:00,2020-03-30T08:30:00+08:00,1,70.0\r\nQ002,2020-12-31,2021-03-31T16:00:00+08:00,2021-03-31T16:30:00+08:00,1,80.0\r\n'))
prices = pd.read_csv(StringIO('asset,observed_at,available_at,raw_open,raw_close,open_available_at,close_available_at,tradable\r\nQ001,2021-03-31,2021-03-31T15:00:00+08:00,98,99,2021-03-31T09:30:00+08:00,2021-03-31T15:00:00+08:00,1\r\nQ001,2021-04-01,2021-04-01T15:00:00+08:00,100,101,2021-04-01T09:30:00+08:00,2021-04-01T15:00:00+08:00,1\r\nQ001,2021-04-15,2021-04-15T15:00:00+08:00,99,99,2021-04-15T09:30:00+08:00,2021-04-15T15:00:00+08:00,1\r\nQ001,2021-04-30,2021-04-30T15:00:00+08:00,100,100,2021-04-30T09:30:00+08:00,2021-04-30T15:00:00+08:00,1\r\nQ001,2021-05-03,2021-05-03T15:00:00+08:00,101,102,2021-05-03T09:30:00+08:00,2021-05-03T15:00:00+08:00,1\r\n'))
dividends = pd.read_csv(StringIO('asset,ex_at,paid_at,cash_per_share\r\nQ001,2021-04-15T09:30:00+08:00,2021-04-20T09:30:00+08:00,2.0\r\n'))
labels = pd.read_csv(StringIO('sample,signal_at,entry_at,exit_at,label_available_at\r\nA,2021-10-29T15:00:00+08:00,2021-11-01T09:30:00+08:00,2021-12-01T09:30:00+08:00,2021-12-01T09:30:00+08:00\r\nB,2021-11-30T15:00:00+08:00,2021-12-01T09:30:00+08:00,2021-12-30T09:30:00+08:00,2021-12-30T09:30:00+08:00\r\nC,2021-12-31T15:00:00+08:00,2022-01-04T09:30:00+08:00,2022-02-01T09:30:00+08:00,2022-02-01T09:30:00+08:00\r\nD,2022-01-31T15:00:00+08:00,2022-02-01T09:30:00+08:00,2022-03-01T09:30:00+08:00,2022-03-01T09:30:00+08:00\r\n'))
texts = pd.read_csv(StringIO('document_id,asset,published_at,available_at,version,text\r\nD001,Q001,2021-03-30T18:00:00+08:00,2021-03-31T08:45:00+08:00,1,本期设备更新，新增产线已投入生产。\r\nD002,Q002,2021-03-31T16:00:00+08:00,2021-03-31T16:45:00+08:00,1,公司披露年度营业资料。\r\n'))
encoders = pd.read_csv(StringIO('encoder,version,training_cutoff,released_at\r\nlexicon-2020,1.0,2020-12-31,2021-01-15T09:00:00+08:00\r\nfuture-encoder-2022,2.0,2022-12-31,2023-01-15T09:00:00+08:00\r\nundocumented-encoder,0.1,,2021-01-20T09:00:00+08:00\r\n'))
minutes = pd.read_csv(StringIO('asset,bar_start,bar_end,available_at,price,volume\r\nQ001,2021-04-01T09:30:00+08:00,2021-04-01T09:31:00+08:00,2021-04-01T09:31:00+08:00,100.0,2000\r\nQ001,2021-04-01T09:31:00+08:00,2021-04-01T09:32:00+08:00,2021-04-01T09:32:00+08:00,100.2,1200\r\nQ001,2021-04-01T09:32:00+08:00,2021-04-01T09:33:00+08:00,2021-04-01T09:33:00+08:00,100.1,800\r\n'))

signal_at = '2021-03-31T15:00:00+08:00'
entry_at = '2021-04-01T09:30:00+08:00'
exit_at = '2021-05-03T09:30:00+08:00'
research_end = "2021-12-31T23:59:59+08:00"

# 1. 数据质量。重复键为 observed_at 和 asset。
quality_report = None

# 2. 信号日历史股票池。退出日期当天起不再纳入。
historical_pool = None

# 3. 每只资产当时最新可用财报。每行保存资产、报告期、版本、值。
selected_reports = None

# 4. 原始开盘价、每股分红和总收益。
# audit_label 依次保存 signal_at、entry_at、exit_at、买价、卖价、分红、总收益。
audit_label = None

# 5. 研究期拟合时，剔除在2021年结束前仍未知的标签。
fit_samples = None
crossing_samples = None

# 6. 版本清单审计。review依次保存可见文档、合格编码器、09:31可见分钟。
version_review = None

answers = [
    "",
    "",
    "",
]

print("质量报告", quality_report)
print("历史股票池", historical_pool)
print("可用财报", selected_reports)
print("收益标签", audit_label)
print("时间切分", fit_samples, crossing_samples)
print("版本审计", version_review)

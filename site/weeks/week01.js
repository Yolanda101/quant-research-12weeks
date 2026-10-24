import {lessons} from './week01-lessons.js';
import {exercises,assignment} from './week01-practice.js';
export default {
 id:'01',number:1,revision:2,title:'研究数据和信息时点',hours:28,
 summary:'整理研究数据，重建历史股票池，核对信号形成前能看到的信息，完成一份数据审计。',
 opening:'2021 年的信号，能使用哪一版财报？',
 openingText:'选择信号时点，检查当时可用的记录。再写代码，把判断过程保存下来。',
 objectives:['按日期重建股票池，保留后来退市的证券。','按可用时间连接财报，识别晚到记录和修订版本。','说明信号、成交和收益标签各自的时间。','检查跨界标签，记录文本、编码器和分钟数据版本。'],
 sessions:[
  {lesson:'schema',exercise:'audit-schema',hours:4,task:'检查字段、单位、重复记录和缺失值。',output:'数据字典和质量报告'},
  {lesson:'universe',exercise:'audit-universe',hours:4,task:'重建历史股票池，比较存续名单。',output:'2021 年 3 月 31 日股票池'},
  {lesson:'availability',exercise:'audit-availability',hours:5,task:'追溯公开时间、入库时间和财报修订。',output:'信号时点可用的财报版本'},
  {lesson:'pricing',exercise:'audit-pricing',hours:5,task:'核对成交价、现金分红和收益标签。',output:'标签说明和手算记录'},
  {lesson:'splits',exercise:'audit-splits',hours:4,task:'设置时间边界，检查训练标签是否已经到期。',output:'时间切分文件'},
  {lesson:'manifest',exercise:'audit-manifest',hours:6,task:'检查文本、编码器和分钟样本，完成综合作业。',output:'版本清单和五条追溯记录'}
 ],
 lessons,exercises,assignment
};

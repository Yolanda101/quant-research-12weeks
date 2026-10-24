import week01 from './weeks/week01.js';
import {buildCheck} from './checks.js';

export const weeks=[week01].map(week=>({
 ...week,
 exercises:week.exercises.map(exercise=>({...exercise,check:exercise.check||buildCheck(exercise.expected)})),
 assignment:{...week.assignment,check:week.assignment.check||buildCheck(week.assignment.expected,{answers:true})}
}));
export const weekById=id=>weeks.find(week=>week.id===id)||weeks[0];

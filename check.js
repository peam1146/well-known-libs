import quiz from "./quiz.json";
// for (const item of quiz.items) {
//   try {
//     const res = await fetch(item.src);
//     if (res.status != 200) console.log(item.answer);
//   } catch (error) {
//     console.log(item.answer);
//   }
// }

// find dup
const a = new Set();
for (const item of quiz.items) {
  if (a.has(item.answer)) {
    console.log(item.answer);
  }
  a.add(item.answer);
}

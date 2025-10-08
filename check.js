import quiz from "./quiz.json";

for (const item of quiz.items) {
  try {
    const res = await fetch(item.src);
    if (res.status != 200) console.log(item.answer);
  } catch (error) {
    console.log(item.answer);
  }
}

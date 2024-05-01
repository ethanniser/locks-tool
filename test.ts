import { parse } from "csv-parse/sync";

// Example CSV line
const csvData = `"4/23/2024,4:00 PM","Lawrence / LSD #4","","windy city league","Active","Published","","","","","aaca","St Bens","1 umpire","","Check or Direct Deposit","Josh Locks","50 cash","","22669272","$0.00 ","$0.00 ","$0.00 ","$0.00 ","$0.00 ","Umpire","Sundheimer, Lucien"`;

// Parsing the CSV data
const records = parse(csvData, {
  columns: false, // Set to true if you want an object with column names as keys
  skip_empty_lines: true,
  trim: true, // Trims whitespace around delimiters
  quote: '"', // Set the quote character
});

console.log(records.join(","));

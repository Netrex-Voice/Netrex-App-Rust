// Release'de Windows'ta ek konsol penceresi açılmasın.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    netrex_lib::run()
}

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Lock, Fuel } from 'lucide-react';

console.log("LOCK_ICON_START");
console.log(renderToStaticMarkup(React.createElement(Lock, { color: "white", size: 48 })));
console.log("LOCK_ICON_END");

console.log("FUEL_ICON_START");
console.log(renderToStaticMarkup(React.createElement(Fuel, { color: "white", size: 48 })));
console.log("FUEL_ICON_END");

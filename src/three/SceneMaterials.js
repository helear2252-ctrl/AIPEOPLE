export const materialThemes={
 'warm minimal':{floor:'#b88c61',wall:'#eee9df',cabinet:'#b7aa98',countertop:'#dedbd2',metal:'#302e2b',sofa:'#e7e0d5',rug:'#c9bba8',wood:'#876444'},
 'minimal white':{floor:'#d8d0c3',wall:'#f7f6f2',cabinet:'#edeae4',countertop:'#d9d9d5',metal:'#77736d',sofa:'#c9c9c5',rug:'#dedbd4',wood:'#b9aa95'},
 'dark luxury':{floor:'#584437',wall:'#a49b90',cabinet:'#3b3835',countertop:'#1e2020',metal:'#111312',sofa:'#484a48',rug:'#6b625a',wood:'#4b382d'},
};
export const resolveMaterial=(theme,key)=>materialThemes[theme]?.[key]||materialThemes['warm minimal'][key]||'#aaa';

import { pickRandomItem } from './utils.ts';

enum Rod {
	Muzsky = 0,
	Stredni = 1,
	Zensky = 2
}

type Adjektivum = string | [muzsky: string, stredni: string, zensky: string];
type Substantivum = [string, Rod];

const adjektiva: Adjektivum[] = [
	'absurdni',
	['antifasisticky', 'antifasisticke', 'antifasisticka'],
	['anarchisticky', 'anarchisticke', 'anarchisticka'],
	['bajecny', 'bajecne', 'bajecna'],
	['bezelstny', 'bezelstne', 'bezelstna'],
	['bojovny', 'bojovne', 'bojovna'],
	'binarni',
	['chapavy', 'chapave', 'chapava'],
	['ctyrvalcovy', 'ctyrvalcove', 'ctyrvalcova'],
	['dadaisticky', 'dadaisticke', 'dadaisticka'],
	'dekadentni',
	'divergentni',
	['divotvorny', 'divotvorne', 'divotvorna'],
	'ekvipotencialni',
	'emotivni',
	'exportni',
	'famozni',
	['fialovy', 'fialove', 'fialova'],
	['ferovy', 'ferove', 'ferova'],
	['feministicky', 'feministicke', 'feministicka'],
	['hydraulicky', 'hydraulicke', 'hydraulicka'],
	'investigativni',
	'interstelarni',
	['jehlicnaty', 'jehlicnate', 'jehlicnata'],
	'kapesni',
	['modrovlasy', 'modrovlase', 'modrovlasa'],
	'nevokalni',
	'neurodivergentnti',
	'spektralni',
	['senzomotoricky', 'senzomotoricke', 'senzomotoricka'],
	['troufaly', 'troufale', 'troufala'],
	'queer',
	['vydatny', 'vydatne', 'vydatna'],
	['vychytraly', 'vychytrale', 'vychytrala']
];

const substantiva: Substantivum[] = [
	['agama', Rod.Zensky],
	['alpaka', Rod.Zensky],
	['anomalocaris', Rod.Muzsky],
	['axolotl', Rod.Muzsky],
	['avokado', Rod.Stredni],
	['bodlin', Rod.Muzsky],
	['delfin', Rod.Muzsky],
	['jezura', Rod.Zensky],
	['kapybara', Rod.Zensky],
	['kakadu', Rod.Muzsky],
	['kosatka', Rod.Zensky],
	['kote', Rod.Stredni],
	['krakatice', Rod.Zensky],
	['lemur', Rod.Muzsky],
	['lenochod', Rod.Muzsky],
	['liska', Rod.Zensky],
	['lodenka', Rod.Zensky],
	['luskoun', Rod.Muzsky],
	['manul', Rod.Muzsky],
	['mlok', Rod.Muzsky],
	['myval', Rod.Muzsky],
	['okapi', Rod.Zensky],
	['plamenak', Rod.Muzsky],
	['ptakopysk', Rod.Muzsky],
	['pterodaktyl', Rod.Muzsky],
	['rak', Rod.Muzsky],
	['racek', Rod.Muzsky],
	['robopes', Rod.Muzsky],
	['rypous', Rod.Muzsky],
	['sakal', Rod.Muzsky],
	['sele', Rod.Stredni],
	['stegosaurus', Rod.Muzsky],
	['surikata', Rod.Zensky],
	['tapir', Rod.Muzsky],
	['tarbik', Rod.Muzsky],
	['vacice', Rod.Zensky],
	['vakovlk', Rod.Muzsky],
	['velociraptor', Rod.Muzsky],
	['vombat', Rod.Muzsky],
	['vydra', Rod.Zensky],
	['zirafa', Rod.Zensky]
];

export const generujJmeno = (validni = (jmeno: string) => true, volne = false): string => {
	const adj = pickRandomItem(adjektiva);
	const subs = pickRandomItem(substantiva);
	const rod = subs[1];

	const adjTvar = Array.isArray(adj) ? adj[rod] : adj;

	let prefix = '';
	if (volne) prefix = rod === Rod.Muzsky ? 'volny-' : rod === Rod.Zensky ? 'volna-' : 'volne-';

	const jmeno = `${prefix}${adjTvar}-${subs[0]}`;
	if (validni(jmeno)) return jmeno;

	return generujJmeno(validni);
};

export const generujNJmen = (
	n: number,
	validni = (jmeno: string) => true,
	volne = false
): string[] => {
	const jmena: string[] = [];
	for (let i = 0; i < n; i++) {
		jmena.push(generujJmeno((j) => validni(j) && !jmena.includes(j), volne));
	}
	return jmena;
};

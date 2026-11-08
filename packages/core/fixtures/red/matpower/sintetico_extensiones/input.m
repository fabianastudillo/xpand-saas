% Caso MATPOWER sintetico escrito para la prueba (feature 003): tablas de extension GTNEP.
% No describe ningun sistema real.
function mpc = sintetico_extensiones
mpc.version = '2';
mpc.baseMVA = 100;

%% bus data
mpc.bus = [
	1	3	0	0	0	0	1	1.0	0	138	1	1.06	0.94;
	2	1	60	20	0	0	1	1.0	0	138	1	1.06	0.94;
	3	1	40	10	0	0	1	1.0	0	69	1	1.06	0.94;
];

%% generator data
mpc.gen = [
	1	80	0	50	-50	1.0	100	1	150	0;
	2	40	0	30	-30	1.0	100	1	90	0;
];

%% branch data
mpc.branch = [
	1	2	0.01	0.1	0.02	200	200	200	0	0	1	-360	360;
	1	3	0.02	0.2	0.03	150	150	150	1.02	0	1	-360	360;
];

%% candidate branches (ne_branch): the ids are in the comments; C23 is written as two circuits
mpc.ne_branch = [
	1	3	0.02	0.2	0.02	100	100	100	1	0	1	-360	360	1.5	2	0;	% C13
	2	3	0.03	0.25	0.01	80	80	80	1	0	1	-360	360	0.8	1	0;	% C23 copia 1/2
	2	3	0.03	0.25	0.01	80	80	80	1	0	1	-360	360	0.8	1	0;	% C23 copia 2/2
];

%% DC nodes: the first one carries a text id (a quoted cell)
mpc.busdc = [
	'DC_A'	1	0	1.0	345	1.1	0.9	0;
	2	1	0.5	1.0	345	1.1	0.9	0;
];

%% DC branches of the existing network (off) and the candidates
mpc.branchdc_ne = [
	1	2	0.05	0	0	100	0	0	1	2.5;	% DCL1
];

%% converters (convdc_ne: 35 columns, PowerModelsACDC layout)
mpc.convdc_ne = [
	1	3	1	1	0	0	0	1.0	0	0	0	0	0	0	0	0	0	345	0	0	0	1	0	0	0	0	0	0	0	0	50	-50	30	-30	12.0;
];

%% candidate generators (used because there is no gtnep_gen nor ne_gen)
mpc.candidate_gen = [
	3	0	0	50	-50	1	100	1	60	0;	% GC3
];

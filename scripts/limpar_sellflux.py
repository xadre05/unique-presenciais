# Limpeza da base do SellFlux para importar no CRM da Unique.
# Uso: python3 scripts/limpar_sellflux.py parte1.csv parte2.csv saida.csv hotmart_vendas.csv
import csv, json, re, sys, collections, unicodedata
from datetime import datetime
ENTRADAS = sys.argv[1:3]; SAIDA = sys.argv[3]; HOTMART = sys.argv[4]

DDDS = {11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99}
motivos = collections.Counter()

def tel_br(t):
    d = re.sub(r'\D', '', t or '')
    if not d: return None, 'sem telefone'
    if (t or '').strip().startswith('+') and not d.startswith('55'): return None, 'número estrangeiro ou falso (+1 555…)'
    if not d.startswith('55') and len(d) in (10, 11): d = '55' + d
    if not (d.startswith('55') and len(d) in (12, 13)):
        return None, 'número estrangeiro ou falso (+1 555…)' if d.startswith('1') else 'número quebrado (tamanho errado)'
    ddd = int(d[2:4]); n = d[4:]
    if ddd not in DDDS: return None, 'DDD que não existe'
    if len(n) == 8 and n[0] in '6789': n = '9' + n
    if not (len(n) == 9 and n[0] == '9'): return None, 'telefone fixo'
    resto = n[1:]
    if len(set(resto)) <= 2 or resto in ('12345678', '87654321', '23456789') or re.search(r'(\d)\1{5,}', resto):
        return None, 'número bugado (repetido/sequência)'
    return '55' + d[2:4] + n, None

LIXO_NOME = re.compile(r'http|www\.|btc|attention|claim|bitcoin|telegram|@', re.I)
GENERICOS = {'cliente', 'lead', 'teste', 'test', 'contato', 'null', 'none', 'usuario', 'usuário', 'whatsapp', 'unknown', 'sem nome', 'aluno', 'aluna', 'dra', 'dr'}
def nome_limpo(s):
    if not s or s == 'null' or LIXO_NOME.search(s): return None
    s = unicodedata.normalize('NFC', s)
    s = ''.join(ch if (ch.isalpha() or ch in " .'-") else ' ' for ch in s)   # tira emoji, *, ~, números
    s = re.sub(r'\bhotmart\b', ' ', s, flags=re.I)
    s = re.sub(r'\s+', ' ', s).strip(" .'-")
    palavras = [p for p in s.split(' ') if p]
    if not palavras or sum(ch.isalpha() for ch in s) < 2: return None
    if s.lower() in GENERICOS: return None
    if s.isupper() or s.islower():
        s = ' '.join(p if p.lower() in ('da', 'de', 'do', 'das', 'dos', 'e') else p[:1].upper() + p[1:].lower() for p in palavras)
    return s[:80]

def email_ok(e):
    e = (e or '').strip().lower()
    return e if re.match(r'^[^@\s]+@[^@\s]+\.[a-z]{2,}$', e) else None

# etiquetas: das 3.465 do SellFlux ficam só as que ajudam a vendedora
INTERESSES = [
    ('biocollagen', r'biocollagen'),
    ('digital press', r'botox|digitalpress|digital-press|capturadp|toxina'),
    ('unique codes', r'codigo-hof|unique-?codes|uniquecodes'),
    ('kissy lips', r'kissy|labio'),
    ('black', r'black|capturabf'),
    ('fios', r'ifqv|fios'),
    ('unique prime', r'prime'),
    ('unique aging', r'aging'),
    ('mentoria', r'mentoria'),
    ('evento presencial', r'imersao|experience|eventosp'),
]
UFS = {'ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pe','pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to'}
def etiquetas(brutas):
    conta = collections.Counter(); saida = set()
    for t in brutas:
        t = t.lower()
        for nome, rx in INTERESSES:
            if re.search(rx, t): conta[nome] += 1
        if re.match(r'^(compra-realizada|compra-aprovada|aluno|compradores)', t): saida.add('sf-comprou')
        if re.match(r'^(abandonou-carrinho|abandono-de-carrinho)', t): saida.add('sf-abandonou-carrinho')
        if re.match(r'^(gerou-pix|gerou-boleto|aguardando-pagamento)', t): saida.add('sf-gerou-pix-boleto')
        if re.match(r'^(grupo-whatsapp|gw-)', t): saida.add('sf-grupo-whatsapp')
        if t in UFS: saida.add('uf:' + t.upper())
    inter = [f'interesse:{n}' for n, _ in conta.most_common()]
    return inter, sorted(saida)

pessoas = {}
lidas = 0
for arq in ENTRADAS:
    for r in csv.DictReader(open(arq, encoding='utf-8')):
        lidas += 1
        tel, motivo = tel_br(r['telefone'])
        if not tel: motivos[motivo] += 1; continue
        try: brutas = json.loads(r['tags']) if r['tags'] not in ('', 'null') else []
        except Exception: brutas = []
        try: dt = datetime.strptime(r['creation_date'], '%d/%m/%Y %H:%M:%S')
        except Exception: dt = None
        nome = nome_limpo(r['nome']); mail = email_ok(r['email'])
        p = pessoas.get(tel)
        if p:
            motivos['repetido (juntado no mesmo contato)'] += 1
        else:
            p = pessoas[tel] = {'nomes': collections.Counter(), 'emails': [], 'tags': [], 'data': dt, 'id': r['id']}
        if nome: p['nomes'][nome] += 1
        if mail and mail not in p['emails']: p['emails'].append(mail)
        p['tags'] += brutas
        if dt and (not p['data'] or dt < p['data']): p['data'] = dt

# o mesmo e-mail em vários telefones: avisa (pode ser a pessoa que trocou de número)
por_email = collections.defaultdict(list)
for tel, p in pessoas.items():
    for e in p['emails']: por_email[e].append(tel)

# cruzamento com a Hotmart (e-mail ou telefone)
hm_mail, hm_tel = set(), set()
if HOTMART:
    for r in csv.DictReader(open(HOTMART, encoding='utf-8'), delimiter=';'):
        if r['Status da transação'] in ('Completo', 'Aprovado', 'Atrasado'):
            if email_ok(r['Email do(a) Comprador(a)']): hm_mail.add(email_ok(r['Email do(a) Comprador(a)']))
            t, _ = tel_br(r['Telefone']);
            if t: hm_tel.add(t)

estat = collections.Counter()
with open(SAIDA, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['id', 'nome', 'telefone', 'email', 'tags', 'id_projeto', 'creation_date'])
    for tel, p in sorted(pessoas.items(), key=lambda x: x[1]['data'] or datetime.min):
        nome = max(p['nomes'].items(), key=lambda x: (x[1], len(x[0])))[0] if p['nomes'] else ''
        inter, outras = etiquetas(p['tags'])
        comprador = tel in hm_tel or any(e in hm_mail for e in p['emails'])
        estat['contatos'] += 1
        estat['com nome' if nome else 'sem nome'] += 1
        estat['com e-mail' if p['emails'] else 'sem e-mail'] += 1
        estat['com interesse' if inter else 'sem interesse'] += 1
        if comprador: estat['é comprador na Hotmart'] += 1
        if 'sf-comprou' in outras: estat['SellFlux marcou compra'] += 1
        if p['data']: estat[f"entrou em {p['data'].year}"] += 1
        # um e-mail só por linha (o importador junta por telefone); os outros vão em linhas repetidas
        emails = p['emails'] or ['']
        for i, e in enumerate(emails):
            w.writerow([p['id'], nome or 'null', '+' + tel, e or 'null', json.dumps(inter + outras if i == 0 else [], ensure_ascii=False), '15162',
                        p['data'].strftime('%d/%m/%Y %H:%M:%S') if p['data'] else ''])
print('linhas lidas', lidas)
print('fora:', dict(motivos))
print(dict(sorted(estat.items())))
print('e-mails em mais de um telefone:', sum(1 for v in por_email.values() if len(v) > 1))

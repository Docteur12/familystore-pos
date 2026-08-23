# Installe l'imprimante de tickets Epson TM sur un poste de caisse (Windows).
#
# À lancer APRÈS avoir installé le pilote Epson (Advanced Printer Driver 6),
# quand l'outil de configuration Epson affiche « L'enregistrement de
# l'imprimante a échoué » : dans ce cas le pilote et le port sont en place,
# seule la file d'impression manque, et sa création exige des droits que
# l'outil Epson n'a pas toujours.
#
# Il répare aussi le cas où l'imprimante existe mais n'imprime rien : voir
# l'explication du port, plus bas.
#
# UTILISATION
#   Menu Démarrer → taper « powershell » → clic droit sur Windows PowerShell
#   → « Exécuter en tant qu'administrateur », puis coller (adapter le chemin) :
#
#     powershell -ExecutionPolicy Bypass -File "C:\chemin\installer-imprimante-ticket.ps1"
#
# Le script diagnostique avant d'agir, n'écrit rien tant que tout n'est pas
# réuni, et se rejoue sans risque.

$ErrorActionPreference = 'Stop'

function Titre($texte) { Write-Host ""; Write-Host "== $texte" -ForegroundColor Cyan }
function Bon($texte)   { Write-Host "  [OK]    $texte" -ForegroundColor Green }
function Souci($texte) { Write-Host "  [!]     $texte" -ForegroundColor Yellow }
function Stop2($texte) { Write-Host "  [STOP]  $texte" -ForegroundColor Red }

Write-Host "Installation de l'imprimante de tickets" -ForegroundColor White

# --- 0. Droits administrateur -----------------------------------------------
Titre "Droits"
$estAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
# On AVERTIT sans bloquer : selon la configuration du poste, la creation
# d'une imprimante locale passe parfois sans elevation. Mieux vaut essayer
# et expliquer en cas d'echec que refuser d'avance un cas qui marcherait.
if ($estAdmin) { Bon "Droits administrateur presents." }
else { Souci "Fenetre sans droits administrateur : on tente quand meme." }

# --- 1. L'imprimante est-elle branchee ? ------------------------------------
Titre "Imprimante branchee"
# VID_04B8 = Seiko Epson. Le nom du modele (TM-T20IV, TM-T88...) est expose
# par le peripherique lui-meme.
$appareil = Get-PnpDevice | Where-Object { $_.InstanceId -match 'VID_04B8' } | Select-Object -First 1
if (-not $appareil) {
  Stop2 "Aucune imprimante Epson detectee sur ce poste."
  Write-Host "        Verifiez le cable USB et que l'imprimante est ALLUMEE,"
  Write-Host "        puis relancez."
  exit 1
}
$modele = try {
  (Get-PnpDeviceProperty -InstanceId $appareil.InstanceId `
     -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc').Data
} catch { 'Epson TM' }
Bon "Detectee : $modele"

# --- 2. Le pilote Epson est-il installe ? -----------------------------------
Titre "Pilote"
# POURQUOI CE SCRIPT NE TELECHARGE PAS LE PILOTE
# Epson sert ses pilotes derriere une acceptation de licence, par des URL
# hachees qui changent a chaque version (download3.ebz.epson.net/dsc/f/...).
# Aucune n'est derivable d'un nom de modele. Un lien fige ici cesserait de
# fonctionner sans prevenir, chez un client, un jour ou personne n'est
# disponible. On fait donc deux choses utiles a la place : reprendre
# l'installateur s'il est pose a cote du script, sinon ouvrir le site Epson
# en annoncant le modele exact a chercher.
$pilote = Get-PrinterDriver | Where-Object { $_.Name -match 'EPSON TM' } | Select-Object -First 1
if (-not $pilote) {
  Stop2 "Le pilote Epson n'est pas installe sur ce poste."
  Write-Host "        Modele a chercher : $modele" -ForegroundColor White
  Write-Host ""

  # Cas du revendeur qui prepare une cle USB : l'installateur voyage avec les
  # scripts, et plus personne n'a besoin d'Internet sur le poste de caisse.
  $dossier = Split-Path -Parent $PSCommandPath
  $local = Get-ChildItem $dossier -File -ErrorAction SilentlyContinue |
           Where-Object { $_.Name -match '(?i)(apd|advanced.?printer.?driver).*\.(exe|zip)$' } |
           Select-Object -First 1

  if ($local) {
    Souci "Installateur trouve a cote du script : $($local.Name)"
    if ($local.Extension -ieq '.zip') {
      Write-Host "          C'est une archive : elle s'ouvre, EXTRAYEZ-LA puis lancez"
      Write-Host "          le Setup.exe qu'elle contient."
    } else {
      Write-Host "          Ouverture. Suivez l'assistant Epson jusqu'au bout."
    }
    Write-Host "          Ensuite, RELANCEZ ce script. Si l'assistant finit par"
    Write-Host "          'L'enregistrement de l'imprimante a echoue', ignorez :"
    Write-Host "          c'est precisement ce que ce script repare."
    Start-Process $local.FullName
  } else {
    Write-Host "        Aucun installateur a cote de ce script, et le telechargement"
    Write-Host "        automatique n'est pas possible : Epson exige une acceptation"
    Write-Host "        de licence et ses liens changent a chaque version."
    Write-Host "        Ouverture du site Epson dans le navigateur..."
    Write-Host "        Choisir 'EPSON Advanced Printer Driver 6', version"
    Write-Host "        Europe/Middle East/Africa."
    Start-Process 'https://download-center.epson.com/'
  }
  Write-Host ""
  Write-Host "        Une fois le pilote installe, relancez ce script." -ForegroundColor White
  exit 1
}
Bon "Pilote : $($pilote.Name)"

# --- 3. Le port -------------------------------------------------------------
Titre "Port"
# L'ORDRE DE PREFERENCE COMPTE, et c'est le piege de toute cette affaire.
# Deux ports coexistent apres l'installation du pilote :
#   ESDPRT001  moniteur 'Epson Port Handler Monitor'  <- celui du pilote APD6
#   USB001     moniteur 'Dynamic Print Monitor'       <- port USB generique
# Sur le port generique, le pilote ACCEPTE les travaux puis echoue : la file
# se remplit, l'etat passe en Erreur, et rien ne sort du rouleau. Constate le
# 22/08/2026. On vise donc le port Epson en priorite.
$port = Get-PrinterPort | Where-Object { $_.PortMonitor -match 'Epson Port Handler' } | Select-Object -First 1
if (-not $port) { $port = Get-PrinterPort | Where-Object { $_.Name -match '^ESDPRT' } | Select-Object -First 1 }
if (-not $port) { $port = Get-PrinterPort | Where-Object { $_.Name -match '^USB\d+' } | Select-Object -First 1 }
if (-not $port) {
  Stop2 "Aucun port d'imprimante trouve."
  Write-Host "        Debranchez puis rebranchez l'imprimante allumee, attendez"
  Write-Host "        dix secondes, et relancez ce script."
  exit 1
}
Bon "Port : $($port.Name) ($($port.PortMonitor))"
if ($port.Name -notmatch '^ESDPRT') {
  Souci "Ce n'est PAS le port Epson (ESDPRT). Si rien ne s'imprime ensuite,"
  Write-Host "          reinstallez l'Advanced Printer Driver 6 : c'est lui qui"
  Write-Host "          cree ce port."
}

# --- 4. La file d'impression ------------------------------------------------
Titre "File d'impression"
$existante = Get-Printer | Where-Object { $_.DriverName -match 'EPSON TM' } | Select-Object -First 1

if ($existante -and $existante.PortName -eq $port.Name) {
  Bon "Deja installee : $($existante.Name) sur $($port.Name)"
  $nom = $existante.Name
}
elseif ($existante) {
  # Cas vecu : imprimante creee sur USB001, file pleine, etat Erreur.
  Souci "Installee sur le mauvais port ($($existante.PortName)) - correction."
  try {
    Get-PrintJob -PrinterName $existante.Name -ErrorAction SilentlyContinue |
      Remove-PrintJob -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Set-Printer -Name $existante.Name -PortName $port.Name -ErrorAction Stop
    Bon "Basculee sur $($port.Name), travaux bloques supprimes."
  } catch {
    Stop2 "Correction refusee : $($_.Exception.Message)"
    if (-not $estAdmin) { Write-Host "        Relancez depuis une fenetre administrateur." }
    exit 1
  }
  $nom = $existante.Name
}
else {
  $nom = "EPSON $modele Receipt"
  try {
    Add-Printer -Name $nom -DriverName $pilote.Name -PortName $port.Name -ErrorAction Stop
    Bon "Imprimante creee : $nom"
  } catch {
    Stop2 "Creation refusee : $($_.Exception.Message)"
    if (-not $estAdmin) {
      Write-Host "        C'est presque surement une question de droits."
      Write-Host "        Ouvrez le menu Demarrer, tapez powershell, clic droit"
      Write-Host "        sur Windows PowerShell > Executer en tant"
      Write-Host "        qu'administrateur, puis relancez la meme commande."
    }
    exit 1
  }
}

# --- 5. Etat final ----------------------------------------------------------
Titre "Etat"
$etat = Get-Printer -Name $nom
if ($etat.PrinterStatus -eq 'Error') {
  Souci "L'imprimante se signale EN ERREUR."
  Write-Host "          Presque toujours du papier : capot mal ferme, rouleau"
  Write-Host "          absent ou monte a l'envers. Corrigez, puis relancez."
} else {
  Bon "Etat : $($etat.PrinterStatus) - $($etat.JobCount) travail(aux) en attente."
}

# --- 6. Tiroir-caisse -------------------------------------------------------
# Enchaine sur l'installation du tiroir si le script est dans le meme dossier,
# pour que le poste soit pret en UNE seule execution.
Titre "Tiroir-caisse"
$scriptTiroir = Join-Path (Split-Path -Parent $PSCommandPath) 'tiroir-caisse.ps1'
if (Test-Path $scriptTiroir) {
  & $scriptTiroir -Installer -Imprimante $nom
} else {
  Souci "tiroir-caisse.ps1 absent de ce dossier : le tiroir ne s'ouvrira pas."
  Write-Host "          Copiez-le a cote de ce script et relancez, ou lancez-le"
  Write-Host "          separement avec -Installer."
}

Write-Host ""
Write-Host "TERMINE." -ForegroundColor Green
Write-Host "A faire maintenant, sur ce poste :" -ForegroundColor White
Write-Host "  1. Page de test : Parametres > Imprimantes > $nom > Proprietes."
Write-Host "     Verifiez d'abord le rouleau et le capot : mal charge, la TM"
Write-Host "     n'imprime rien et se contente de clignoter."
Write-Host "  2. Dans la caisse, au moment d'imprimer, choisir $nom comme"
Write-Host "     destination, et DECOCHER 'En-tetes et pieds de page' dans"
Write-Host "     'Plus de parametres' - sinon Chrome ajoute l'URL et la date"
Write-Host "     en haut du ticket."





# Ouverture automatique du tiroir-caisse à chaque ticket imprimé.
#
# POURQUOI CE SCRIPT PLUTÔT QU'UN RÉGLAGE DU PILOTE
# Le pilote Epson APD6 sait envoyer l'impulsion lui-même, mais sur ce modèle
# (TM-T20IV, pilote « EPSON TM-T(203dpi) Receipt6 ») la page de réglage
# n'est exposée nulle part : ni dans les Propriétés Windows (onglet
# « Paramètres du périphérique » : polices, échelle, largeur de rouleau
# seulement), ni dans l'utilitaire APD, ni dans PrinterReg. Vérifié écran par
# écran le 22/08/2026.
#
# COMMENT ÇA MARCHE
# Windows journalise chaque document imprimé (événement 307 du journal
# Microsoft-Windows-PrintService/Operational). Une tâche planifiée écoute cet
# événement — filtré sur CETTE imprimante — et rejoue l'impulsion ESC/POS
# `ESC p m t1 t2` vers le spouleur en mode RAW.
#
# On écoute le journal plutôt que de sonder les travaux d'impression : un
# ticket sort en moins d'une seconde, un sondage le raterait. Le journal, lui,
# enregistre après coup et ne manque rien.
#
# UTILISATION
#   Installation (une fois, EN ADMINISTRATEUR) :
#     powershell -ExecutionPolicy Bypass -File tiroir-caisse.ps1 -Installer
#   Vérifier que le tiroir répond :
#     powershell -ExecutionPolicy Bypass -File tiroir-caisse.ps1 -Test
#   Retirer :
#     powershell -ExecutionPolicy Bypass -File tiroir-caisse.ps1 -Desinstaller
#
# Sans paramètre, le script se contente d'envoyer l'impulsion : c'est ce que
# la tâche planifiée appelle à chaque ticket.

param(
  [string] $Imprimante = '',
  [ValidateSet(2, 5)] [int] $Broche = 2,
  [switch] $Installer,
  [switch] $Desinstaller,
  [switch] $Test
)

$ErrorActionPreference = 'Stop'

$TACHE      = 'TiroirCaisse'
$JOURNAL    = 'Microsoft-Windows-PrintService/Operational'
$DOSSIER    = Join-Path $env:ProgramData 'TiroirCaisse'
$INSTALLE   = Join-Path $DOSSIER 'tiroir-caisse.ps1'
$MARQUEUR   = Join-Path $DOSSIER 'derniere-impulsion.txt'

# LA BOUCLE, ET COMMENT ON L'EMPÊCHE
# L'impulsion part vers le spouleur : elle produit donc, elle aussi, un
# événement 307. Sans précaution, la tâche se redéclenche sur sa propre
# impulsion et le tiroir se rouvre sans fin — constaté le 22/08/2026, la
# tâche s'est relancée dix fois en dix secondes.
#
# Deux garde-fous indépendants :
#  1. le déclencheur ignore les documents de 5 octets — la taille exacte de
#     l'impulsion, qu'aucun ticket réel n'atteindra jamais ;
#  2. l'anti-rebond ci-dessous refuse deux impulsions rapprochées.
# Le second protège si le premier venait à ne plus discriminer.
$OCTETS_IMPULSION    = 5
$FENETRE_ANTI_REBOND = 4   # secondes

function Bon($t)   { Write-Host "  [OK]    $t" -ForegroundColor Green }
function Souci($t) { Write-Host "  [!]     $t" -ForegroundColor Yellow }
function Stop2($t) { Write-Host "  [STOP]  $t" -ForegroundColor Red }

function EstAdmin {
  ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Imprimante ticket = celle qui porte un pilote Epson TM. Sur un poste de
# caisse il n'y en a qu'une ; on ne devine pas au-dela.
function TrouverImprimante {
  $p = Get-Printer | Where-Object { $_.DriverName -match 'EPSON TM' } | Select-Object -First 1
  if (-not $p) { throw "Aucune imprimante Epson TM installee. Lancez d'abord installer-imprimante-ticket.ps1." }
  $p.Name
}

# --- Anti-rebond ------------------------------------------------------------
# Second garde-fou contre la boucle, et accessoirement : deux exemplaires d'un
# meme ticket n'ouvrent le tiroir qu'une fois, ce qui est le comportement
# attendu en caisse.
#
# Format de date invariant : le poste peut etre en francais, la tache tourne
# en compte SYSTEME, et une date lue dans une autre culture serait mal
# interpretee - donc jamais de rebond detecte au mauvais moment.
function ImpulsionTropRecente {
  if (-not (Test-Path $MARQUEUR)) { return $false }
  try {
    $texte = (Get-Content $MARQUEUR -Raw -ErrorAction Stop).Trim()
    $t = [datetime]::ParseExact($texte, 'o', [Globalization.CultureInfo]::InvariantCulture,
                                [Globalization.DateTimeStyles]::RoundtripKind)
    return ((Get-Date) - $t).TotalSeconds -lt $FENETRE_ANTI_REBOND
  } catch {
    # Marqueur illisible : on laisse passer. Un tiroir qui s'ouvre est moins
    # grave qu'un tiroir qui reste ferme au moment de rendre la monnaie.
    return $false
  }
}

function MarquerImpulsion {
  try {
    if (-not (Test-Path $DOSSIER)) { New-Item -ItemType Directory -Path $DOSSIER -Force | Out-Null }
    Set-Content -Path $MARQUEUR -Value (Get-Date).ToString('o') -Encoding ASCII -ErrorAction Stop
  } catch { }   # sans droits d'ecriture, on perd l'anti-rebond, pas l'ouverture
}

# --- Envoi de l'impulsion ---------------------------------------------------
# On ecrit dans le spouleur en RAW : les octets traversent le pilote sans etre
# reinterpretes. C'est la seule facon d'atteindre le connecteur DK depuis
# Windows sans passer par un reglage du pilote.
function ImpulsionTiroir([string] $imprimante, [int] $broche) {
  if (-not ('RawSpool' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public class RawSpool {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
                         [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
                         [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.Drv", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.Drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.Drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", SetLastError=true)]
  static extern bool WritePrinter(IntPtr h, IntPtr buf, int count, out int written);

  public static string Envoyer(string imprimante, byte[] octets) {
    IntPtr h;
    if (!OpenPrinter(imprimante, out h, IntPtr.Zero)) return "OpenPrinter: " + Marshal.GetLastWin32Error();
    DOCINFO di = new DOCINFO(); di.pDocName = "Tiroir-caisse"; di.pDataType = "RAW";
    if (!StartDocPrinter(h, 1, di)) { ClosePrinter(h); return "StartDocPrinter: " + Marshal.GetLastWin32Error(); }
    StartPagePrinter(h);
    IntPtr buf = Marshal.AllocCoTaskMem(octets.Length);
    Marshal.Copy(octets, 0, buf, octets.Length);
    int ecrits; bool ok = WritePrinter(h, buf, octets.Length, out ecrits);
    Marshal.FreeCoTaskMem(buf);
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return ok ? "OK" : ("WritePrinter: " + Marshal.GetLastWin32Error());
  }
}
'@
  }
  # ESC p m t1 t2 — m = 0 (broche 2) ou 1 (broche 5), impulsion 25 ms / 250 ms.
  $m = if ($broche -eq 5) { 1 } else { 0 }
  [RawSpool]::Envoyer($imprimante, [byte[]](0x1B, 0x70, $m, 0x19, 0xFA))
}

# --- Installation -----------------------------------------------------------
function Poser {
  if (-not (EstAdmin)) {
    Stop2 "L'installation exige les droits administrateur."
    Write-Host "        Menu Demarrer > taper powershell > clic droit >"
    Write-Host "        Executer en tant qu'administrateur, puis relancez."
    exit 1
  }

  $nom = if ($Imprimante) { $Imprimante } else { TrouverImprimante }
  Bon "Imprimante : $nom"

  # 1. Le journal d'impression est desactive par defaut sous Windows.
  #    Via .NET plutot que « wevtutil » : sous PowerShell 5.1, la sortie
  #    d'erreur d'un executable natif devient une erreur TERMINANTE quand
  #    ErrorActionPreference vaut 'Stop', et le script s'arrete en silence.
  $j = Get-WinEvent -ListLog $JOURNAL
  if (-not $j.IsEnabled) {
    $cfg = New-Object System.Diagnostics.Eventing.Reader.EventLogConfiguration $JOURNAL
    $cfg.IsEnabled = $true
    $cfg.SaveChanges()
    $j = Get-WinEvent -ListLog $JOURNAL
    if (-not $j.IsEnabled) { Stop2 "Impossible d'activer le journal $JOURNAL."; exit 1 }
  }
  Bon "Journal d'impression actif."

  # 2. Copie a un emplacement stable : la tache doit survivre au deplacement
  #    ou a la suppression du dossier d'ou l'installation a ete lancee.
  New-Item -ItemType Directory -Path $DOSSIER -Force | Out-Null
  Copy-Item -Path $PSCommandPath -Destination $INSTALLE -Force
  Bon "Script installe : $INSTALLE"

  # 3. Tache declenchee par l'evenement 307, FILTRE SUR CETTE IMPRIMANTE.
  #    Sans ce filtre, une impression PDF ou vers une autre imprimante
  #    ouvrirait le tiroir.
  #    Param5 = imprimante, Param7 = taille du document en octets. Exclure
  #    les documents de $OCTETS_IMPULSION octets ecarte nos propres
  #    impulsions et casse la boucle a la source.
  $nomXml = $nom.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;')
  $requete = "&lt;QueryList&gt;&lt;Query Id='0' Path='$JOURNAL'&gt;&lt;Select Path='$JOURNAL'&gt;" +
             "*[System[(EventID=307)]] and *[UserData[DocumentPrinted[" +
             "(Param5='$nomXml') and (Param7!='$OCTETS_IMPULSION')]]]" +
             "&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;"

  # Surtout pas $args : c'est une variable automatique de PowerShell.
  $argsTache = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$INSTALLE`" -Imprimante `"$nom`" -Broche $Broche"

  $xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Ouvre le tiroir-caisse a chaque ticket imprime sur $nomXml.</Description>
  </RegistrationInfo>
  <Triggers>
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>$requete</Subscription>
    </EventTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT1M</ExecutionTimeLimit>
    <Priority>5</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>$argsTache</Arguments>
    </Exec>
  </Actions>
</Task>
"@

  # Cmdlets et non « schtasks » : meme raison que pour wevtutil ci-dessus.
  if (Get-ScheduledTask -TaskName $TACHE -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TACHE -Confirm:$false
  }
  try {
    Register-ScheduledTask -TaskName $TACHE -Xml $xml -Force | Out-Null
  } catch {
    Stop2 "Creation de la tache refusee : $($_.Exception.Message)"
    exit 1
  }
  # On relit ce qui a ete REELLEMENT enregistre : une tache creee mais sans
  # declencheur ne servirait a rien, et rien ne le signalerait.
  $posee = Get-ScheduledTask -TaskName $TACHE -ErrorAction SilentlyContinue
  if (-not $posee -or -not $posee.Triggers) {
    Stop2 "La tache existe mais sans declencheur : elle ne se lancerait jamais."
    exit 1
  }
  Bon "Tache '$TACHE' posee (declenchee par chaque ticket imprime)."

  # 4. Verification immediate : l'impulsion part-elle ?
  $r = ImpulsionTiroir $nom $Broche
  if ($r -eq 'OK') { Bon "Impulsion de controle envoyee - le tiroir doit s'ouvrir MAINTENANT." }
  else { Souci "L'impulsion a echoue : $r" }

  Write-Host ""
  Write-Host "INSTALLE." -ForegroundColor Green
  Write-Host "Imprimez un ticket depuis la caisse : le tiroir doit s'ouvrir juste apres."
  Write-Host "Si le tiroir n'a pas bouge a l'instant, verifiez le cable RJ11 sur la"
  Write-Host "prise DK de l'imprimante, la cle du tiroir, et l'alimentation d'origine."
  Write-Host "Si votre tiroir est cable sur la broche 5, reinstallez avec -Broche 5."
}

function Retirer {
  if (-not (EstAdmin)) { Stop2 "Desinstallation : droits administrateur requis."; exit 1 }
  if (Get-ScheduledTask -TaskName $TACHE -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TACHE -Confirm:$false
  }
  Remove-Item $DOSSIER -Recurse -Force -ErrorAction SilentlyContinue
  Bon "Tache et script retires. Le journal d'impression reste actif (sans effet)."
}

# --- Point d'entree ---------------------------------------------------------
if ($Desinstaller) { Retirer; exit 0 }
if ($Installer)    { Poser;   exit 0 }

$nom = if ($Imprimante) { $Imprimante } else { TrouverImprimante }

# Anti-rebond. Ignore pour un test explicite : c'est l'operateur qui demande.
if (-not $Test -and (ImpulsionTropRecente)) { exit 0 }

$r = ImpulsionTiroir $nom $Broche
if ($r -eq 'OK') { MarquerImpulsion }

if ($Test) {
  if ($r -eq 'OK') { Bon "Impulsion envoyee a '$nom' (broche $Broche) - le tiroir doit s'ouvrir." }
  else { Stop2 "Echec : $r"; exit 1 }
}
if ($r -ne 'OK') { exit 1 }





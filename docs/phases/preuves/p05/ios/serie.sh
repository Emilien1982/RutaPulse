cd /Users/utilisateur/dev_ai/vtt-nav-preuves/p05/t7-banc
O=/Users/utilisateur/dev_ai/vtt-nav-preuves/p05/ios
for k in 1 2 3; do sh raz.sh ios; sh banc.sh ios affichage-froid $O/c9-affichage/froid-$k; done
for k in 1 2 3; do sh raz.sh ios; sh banc.sh ios affichage-chaud $O/c9-affichage/chaud-$k; done
for k in 1 2 3; do sh raz.sh ios; sh banc.sh ios geste $O/c9-geste/geste-$k; done
sh raz.sh ios; sh banc.sh ios temoin $O/c9-geste/temoin-1
sh raz.sh ios
echo FINI

<?php
include("../res/x5engine.php");
$nameList = array("de8","4tl","d52","ac6","pkc","6h3","xzg","uap","8rf","m26");
$charList = array("L","Z","S","V","2","F","K","M","G","E");
$cpt = new X5Captcha($nameList, $charList);
//Check Captcha
if ($_GET["action"] == "check")
	echo $cpt->check($_GET["code"], $_GET["ans"]);
//Show Captcha chars
else if ($_GET["action"] == "show")
	echo $cpt->show($_GET['code']);
// End of file x5captcha.php

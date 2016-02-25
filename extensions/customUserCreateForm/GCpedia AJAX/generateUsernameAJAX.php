<?php
/**
 * Username generator for GCPEDIA Userlogin.php
 *
 * The users email is used to generate the username, so it is assumed that all emails are in standard GC format:
 * givenname.familyname@institution.gc.ca
 * duplicate usernames are incremented by (int)1 until they are available
 *
 * @param  $emailInput <string> users email address
 *
 * @return always returns "" because we use the response text directly
 *
 * @author Matthew April <Matthew.April@tbs-sct.gc.ca>, Ilia Salem
 */

class generateUsernameAJAX extends ApiBase
{
	/**
	 * Returns an array of allowed parameters (parameter name) => (default
	 * value) or (parameter name) => (array with PARAM_* constants as keys)
	 * Don't call this function directly: use getFinalParams() to allow
	 * hooks to modify parameters as needed.
	 *
	 * Some derived classes may choose to handle an integer $flags parameter
	 * in the overriding methods. Callers of this method can pass zero or
	 * more OR-ed flags like GET_VALUES_FOR_HELP.
	 *
	 * @return array
	 */
	protected function getAllowedParams( /* $flags = 0 */ ) {
		// int $flags is not declared because it causes "Strict standards"
		// warning. Most derived classes do not implement it.
		return array(
			'emailinput' => '');
	}


	public function execute() {
		// extract request parameters
		$params = $this->extractRequestParams();
		$emailInput = $params['emailinput'];
	
		$email = trim($emailInput);
		
		if ( strlen( $email ) > 0 ) {
			
			$domainPos = strpos($email, '@') + 1;
			$domain = substr($email, $domainPos);
			
			# make sure selected domain is not the example domain (this is already checked for in the JS, but do it anyway)
			if($domain == "example") {
				# NOTE: the '>' character is used to make the username invalid.
				echo "> Invalid domain";
				return "";
			}
			
			$dbr = wfGetDB( DB_SLAVE );
			$emailQuery = $dbr->addQuotes($email);
			
			#count number of emails
			// $query2 = "SELECT count(*) FROM " .$dbr->tableName('user') ." WHERE user_email = \"". $emailQuery ."\"";
			// $result2 = $dbr->doQuery($query2);
			// $emailrow = $dbr->fetchRow($result2);
			$emailrow = $dbr->select( $dbr->tableName('user'), 'user_email', 'user_email = "' . $emailQuery . '"', __METHOD__, array() );
			
			#check if email in use
			// if ( $emailrow[0] > 0 ) {
			// 	# NOTE: the '>' character is used to make the username invalid.
			// 	echo "> " . wfMsg('email-in-use'); //translate this
			// 	return "";
			// }
			if ( $emailrow->numRows() > 0 ) {
				# NOTE: the '>' character is used to make the username invalid.
				$this->getResult()->addValue( null, $this->getModuleName(), "> " . wfMsg('email-in-use') ); //translate this
				return "";
			}

			$usrname = ucfirst( strtok( $email, '@' ) );
			
			##Capitalize first and last name##
			if(substr_count($usrname, ".") == 1) { #make sure they have one, and only one period in their username (should typically be the case, but check anyway)
				
				$lastnamePos = strpos($usrname, ".") + 1;
				$lastnameLetter = substr($usrname, $lastnamePos, 1); #first letter of last name
				$lastnameLetter = strtoupper($lastnameLetter); #force uppercase
				
				$usrname = substr_replace($usrname, $lastnameLetter, $lastnamePos, 1); #replace original with uppercase
			}

			if(rtrim($usrname, "0..9") != "") {
				$usrname = rtrim($usrname, "0..9");
			}
			
			#select matching usernames
			$usrnameQuery = $dbr->addQuotes($usrname);
			// $query = "SELECT user_id FROM " .$dbr->tableName('user') ." WHERE user_name LIKE \"". $usrnameQuery ."\" COLLATE latin1_swedish_ci";

			// $result1 = $dbr->doQuery($query);
			
			$result1 = $dbr->select( $dbr->tableName('user'), 'user_id', 'user_name LIKE "' . $usrnameQuery . '"', __METHOD__, array( 'COLLATE' => 'latin1_swedish_ci' ) );

			#check if username exists and increment it
			// if ( mysql_num_rows($result1) > 0 ){
			if ( $result1->numRows() > 0 ){
				
				$unamePostfix = 0;
				
				do {
					$unamePostfix++;
					
					$tmpUsrnameQuery = $usrnameQuery . $unamePostfix;
					
					// $query = "SELECT user_id FROM " .$dbr->tableName('user') ." WHERE user_name LIKE \"". $tmpUsrnameQuery ."\" COLLATE latin1_swedish_ci";
					// $tmpResult = $dbr->doQuery($query);
					$tmpResult = $dbr->select( $dbr->tableName('user'), 'user_id', 'user_name LIKE "' . $tmpUsrnameQuery . '"', __METHOD__, array( 'COLLATE' => 'latin1_swedish_ci' ) );

					$uname = $usrname . $unamePostfix;
					
				// } while ( mysql_num_rows($tmpResult) > 0);
				} while ( $tmpResult->numRows() > 0);
				
			}else{
				#username is available
				$uname = $usrname;
			}
				
			#username output
			$this->getResult()->addValue( null, $this->getModuleName(), $uname );
									
		}
		
		return "";
	}
}

?>
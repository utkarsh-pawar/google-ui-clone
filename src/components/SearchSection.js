import classes from './Search.module.css'
import React, { useState, useRef } from 'react'
import { FaSearch } from 'react-icons/fa'
import { BiMicrophone } from 'react-icons/bi'

const SearchSection = () => {

    const [isEmpty, setIsEmpty] = useState(true)

    const refValue = useRef()

    const inputHandler = (event) => {
        // console.log(event.target.value);
        // console.log(inputValue);
        if (event.target.value.trim() !== '') {
            setIsEmpty(false)
        } else {
            setIsEmpty(true)
        }
    }

    const cancelHandler = () => {
        refValue.current.value = "";
        setIsEmpty(true)
    }

    return (
        <div className={classes.search}>

            <div className={classes['search-bar']}>

                <div className={classes['search-logo']}><FaSearch></FaSearch></div>

                <input className={classes.input} type="text" onChange={inputHandler} ref={refValue} />



                {/* {isEmpty && <div>
                    </div> } */}

                {!isEmpty && <div className={classes.cancel} onClick={cancelHandler}>
                    X</div>}


                <div className={classes['mic-logo']}>
                    <BiMicrophone></BiMicrophone>
                </div>
            </div>
            <div className={classes['search-button']}>
                <button>Google Search</button>
                <button>I'm Feeling Lucky</button>

            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.8)',marginTop:'0.5rem' }}>
                Google offered in: <a style={{margin:'0.35rem'}} href='#'>Hindi</a><a style={{margin:'0.35rem'}} href='#'>Bangla</a><a  style={{margin:'0.35rem'}} href='#'>Marathi</a><a  style={{margin:'0.35rem'}} href='#'>Gujrati</a>
            </div>
        </div>
    )
}

export default SearchSection
